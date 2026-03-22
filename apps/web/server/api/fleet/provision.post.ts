import { z } from 'zod'
import { readBody, getHeader, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { fleetApps, provisionJobs } from '#server/database/schema'
import { createD1Database } from '#server/utils/provision-cloudflare'
import {
  createDopplerProject,
  syncHubSecrets,
  syncDevConfig,
  createDopplerServiceToken,
  getDopplerSecrets,
  bulkSetSecrets,
} from '#server/utils/provision-doppler'
import { setRepoSecret, triggerWorkflow } from '#server/utils/provision-github'
import {
  parseServiceAccountJson,
  getGoogleAccessToken,
  createGA4Property,
  createGA4DataStream,
  registerGscSite,
  getGscVerificationToken,
  generateIndexNowKey,
} from '#server/utils/provision-analytics'

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      'Must be lowercase alphanumeric with hyphens, starting with a letter or number',
    ),
  displayName: z.string().min(1).max(200),
  url: z.string().url(),
  githubOrg: z.string().min(1).optional().default('narduk-enterprises'),
})

/**
 * POST /api/fleet/provision
 *
 * Authenticated endpoint to provision a new fleet app. Full server-side
 * infrastructure provisioning with idempotent operations:
 *
 *   1. Upsert app in fleet_apps D1 (update if exists, insert if new)
 *   2. Create GitHub repo via REST API
 *   3. Create D1 database via Cloudflare API
 *   4. Create Doppler project + sync hub secrets (per-app secrets only set if missing)
 *   5. Delete-then-recreate Doppler CI service token → set as GitHub repo secret
 *   6. Create GA4 property + data stream
 *   7. Register GSC site + get verification token
 *   8. Reuse or generate IndexNow key
 *   9. Write analytics IDs back to Doppler
 *  10. Dispatch provision-app.yml with pre-provisioned IDs
 *
 * All steps are idempotent — safe to retry on partial failure or re-provision.
 */
export default defineEventHandler(async (event) => {
  // ── Auth: shared PROVISION_API_KEY ──
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'authorization')
  const providedKey = authHeader?.replace('Bearer ', '')

  if (!config.provisionApiKey || providedKey !== config.provisionApiKey) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized — invalid or missing PROVISION_API_KEY',
    })
  }

  // ── Validate body ──
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    })
  }

  const { name, displayName, url, githubOrg } = parsed.data
  const githubRepo = `${githubOrg}/${name}`
  const now = new Date().toISOString()
  const db = useDatabase(event)

  /** Helper: update provision job status + optional details */
  async function updateStatus(
    provisionId: string,
    status: string,
    extra?: { errorMessage?: string },
  ) {
    await db
      .update(provisionJobs)
      .set({ status, ...extra, updatedAt: new Date().toISOString() })
      .where(eq(provisionJobs.id, provisionId))
  }

  // ── 1. Register in fleet_apps (idempotent: upsert) ──
  const existing = await db.select().from(fleetApps).where(eq(fleetApps.name, name)).limit(1).all()

  if (existing.length > 0) {
    // App already registered — update fields that may have changed and continue
    await db
      .update(fleetApps)
      .set({
        url,
        githubRepo,
        isActive: true,
        updatedAt: now,
      })
      .where(eq(fleetApps.name, name))
  } else {
    await db.insert(fleetApps).values({
      name,
      url,
      dopplerProject: name,
      githubRepo,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  // ── 2. Create provision job ──
  const provisionId = `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  await db.insert(provisionJobs).values({
    id: provisionId,
    appName: name,
    displayName,
    appUrl: url,
    githubRepo,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  })

  const ghToken = config.controlPlaneGhServiceToken
  if (!ghToken) {
    await updateStatus(provisionId, 'failed', {
      errorMessage: 'CONTROL_PLANE_GH_SERVICE_TOKEN not configured',
    })
    throw createError({
      statusCode: 500,
      message: 'GitHub service token not configured on control plane.',
    })
  }

  // ── 3. Create GitHub repo ──
  await updateStatus(provisionId, 'creating_repo')

  try {
    const repoRes = await fetch(`https://api.github.com/orgs/${githubOrg}/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'narduk-control-plane',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        name,
        description: `${displayName} — provisioned by Narduk Control Plane`,
        private: false,
        auto_init: false,
      }),
    })

    if (!repoRes.ok && repoRes.status !== 422) {
      const errText = await repoRes.text().catch(() => '')
      throw new Error(`GitHub repo creation failed: ${repoRes.status} ${errText}`)
    }
  } catch (err: unknown) {
    const error = err as { message?: string }
    await updateStatus(provisionId, 'failed', {
      errorMessage: `Repo creation: ${error.message}`,
    })
    throw createError({ statusCode: 502, message: `GitHub repo creation error: ${error.message}` })
  }

  // ── 4. Create D1 database ──
  await updateStatus(provisionId, 'provisioning_d1')

  let d1DatabaseId = ''
  const d1DatabaseName = `${name}-db`
  try {
    const cfAccountId = config.cloudflareAccountId
    const cfToken = config.cloudflareApiToken
    if (!cfAccountId || !cfToken) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not configured')
    }

    const d1Result = await createD1Database(cfAccountId, cfToken, d1DatabaseName)
    d1DatabaseId = d1Result.uuid
  } catch (err: unknown) {
    const error = err as { message?: string }
    await updateStatus(provisionId, 'failed', {
      errorMessage: `D1 provisioning: ${error.message}`,
    })
    throw createError({ statusCode: 502, message: `D1 provisioning failed: ${error.message}` })
  }

  // ── 5. Doppler project + hub secrets ──
  await updateStatus(provisionId, 'provisioning_doppler')

  let dopplerServiceTokenValue = ''
  try {
    const dopplerToken = config.dopplerApiToken
    if (!dopplerToken) {
      throw new Error('DOPPLER_API_TOKEN not configured')
    }

    // Create project (idempotent)
    await createDopplerProject(
      dopplerToken,
      name,
      `${displayName} — auto-provisioned by Control Plane`,
    )

    // Generate random per-app secrets
    const randomHex = (n: number) =>
      Array.from(crypto.getRandomValues(new Uint8Array(n)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    const cronSecret = randomHex(32)
    const sessionPassword = randomHex(32)

    // Sync hub secrets as cross-project references + set per-app secrets
    await syncHubSecrets(
      dopplerToken,
      'narduk-nuxt-template', // hub project
      'prd', // hub config
      name, // spoke project
      'prd', // spoke config
      {
        APP_NAME: name,
        SITE_URL: url,
        CRON_SECRET: cronSecret,
        NUXT_SESSION_PASSWORD: sessionPassword,
      },
    )

    // Populate dev config so local development works immediately
    await syncDevConfig(
      dopplerToken,
      'narduk-nuxt-template', // hub project
      'prd', // hub config
      name, // spoke project
      {
        APP_NAME: name,
        SITE_URL: url,
        CRON_SECRET: cronSecret,
        NUXT_SESSION_PASSWORD: sessionPassword,
      },
    )

    // Create CI service token
    dopplerServiceTokenValue = await createDopplerServiceToken(
      dopplerToken,
      name,
      'prd',
      'ci-deploy',
    )
  } catch (err: unknown) {
    const error = err as { message?: string }
    await updateStatus(provisionId, 'failed', {
      errorMessage: `Doppler provisioning: ${error.message}`,
    })
    throw createError({ statusCode: 502, message: `Doppler provisioning failed: ${error.message}` })
  }

  // ── 6. Set GitHub repo secrets for CI ──
  // The new app's CI workflows (reusable-quality.yml, reusable-deploy.yml) need:
  //   - DOPPLER_TOKEN: fetch secrets at build time
  //   - GH_PACKAGES_TOKEN: authenticate with GitHub Packages for @narduk-enterprises/* deps
  //   - CONTROL_PLANE_URL: deploy callback to fleet registry
  try {
    const secretsToSet: Array<{ name: string; value: string | null }> = [
      { name: 'DOPPLER_TOKEN', value: dopplerServiceTokenValue },
    ]

    // GH_PACKAGES_TOKEN: try 0_global-canonical-tokens first, then hub project
    const dopplerToken = config.dopplerApiToken
    if (dopplerToken) {
      try {
        // Primary: global canonical tokens (where GH PATs typically live)
        let ghPackagesToken = ''
        try {
          const globalSecrets = await getDopplerSecrets(
            dopplerToken,
            '0_global-canonical-tokens',
            'prd',
          )
          ghPackagesToken = globalSecrets.GH_PACKAGES_TOKEN || ''
        } catch {
          // Fallback: try hub project
          const hubSecrets = await getDopplerSecrets(dopplerToken, 'narduk-nuxt-template', 'prd')
          ghPackagesToken = hubSecrets.GH_PACKAGES_TOKEN || ''
        }
        if (ghPackagesToken) {
          secretsToSet.push({ name: 'GH_PACKAGES_TOKEN', value: ghPackagesToken })
        } else {
          console.warn('GH_PACKAGES_TOKEN not found in Doppler — new repo CI may need manual setup')
        }
      } catch {
        console.warn(
          'Could not read GH_PACKAGES_TOKEN from Doppler — new repo CI may need manual setup',
        )
      }
    }

    // CONTROL_PLANE_URL: derive from runtime or use canonical
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
    secretsToSet.push({ name: 'CONTROL_PLANE_URL', value: controlPlaneUrl })

    // Set all secrets
    for (const secret of secretsToSet) {
      if (secret.value) {
        await setRepoSecret(ghToken, githubRepo, secret.name, secret.value)
      }
    }
  } catch (err: unknown) {
    const error = err as { message?: string }
    await updateStatus(provisionId, 'failed', {
      errorMessage: `GitHub secrets: ${error.message}`,
    })
    throw createError({
      statusCode: 502,
      message: `GitHub secrets set failed: ${error.message}`,
    })
  }

  // ── 7-9. Analytics provisioning ──
  await updateStatus(provisionId, 'provisioning_analytics')

  let gaPropertyId = ''
  let gaMeasurementId = ''
  let gscVerificationFileName = ''
  let gscVerificationContent = ''
  let indexNowKey = ''

  try {
    const serviceAccountJson = config.googleServiceAccountKey
    const gaAccountId = config.gaAccountId

    if (serviceAccountJson && gaAccountId) {
      const credentials = parseServiceAccountJson(serviceAccountJson)

      // 7a. GA4 property + data stream
      const gaAccessToken = await getGoogleAccessToken(credentials, [
        'https://www.googleapis.com/auth/analytics.edit',
      ])

      const property = await createGA4Property(gaAccessToken, gaAccountId, name, url)
      gaPropertyId = property.propertyId

      const stream = await createGA4DataStream(gaAccessToken, property.propertyName, name, url)
      gaMeasurementId = stream.measurementId

      // 7b. GSC registration + verification token
      const gscAccessToken = await getGoogleAccessToken(credentials, [
        'https://www.googleapis.com/auth/webmasters',
        'https://www.googleapis.com/auth/siteverification',
      ])

      await registerGscSite(gscAccessToken, url)

      const verification = await getGscVerificationToken(gscAccessToken, url)
      gscVerificationFileName = verification.fileName
      gscVerificationContent = verification.fileContent
    }

    // 8. IndexNow key (idempotent: reuse existing if already in Doppler)
    const dopplerToken2 = config.dopplerApiToken
    if (dopplerToken2) {
      try {
        const existingSecrets = await getDopplerSecrets(dopplerToken2, name, 'prd')
        if (existingSecrets.INDEXNOW_KEY) {
          indexNowKey = existingSecrets.INDEXNOW_KEY
        }
      } catch {
        // Fresh project — generate new key below
      }
    }
    if (!indexNowKey) {
      indexNowKey = generateIndexNowKey()
    }

    // 9. Write analytics IDs back to Doppler
    if (dopplerToken2 && (gaPropertyId || indexNowKey)) {
      const analyticsSecrets: Record<string, string> = {}
      if (gaPropertyId) analyticsSecrets.GA_PROPERTY_ID = gaPropertyId
      if (gaMeasurementId) analyticsSecrets.GA_MEASUREMENT_ID = gaMeasurementId
      if (indexNowKey) analyticsSecrets.INDEXNOW_KEY = indexNowKey
      await bulkSetSecrets(dopplerToken2, name, 'prd', analyticsSecrets)
      // Also write analytics IDs to dev so local dev has them
      await bulkSetSecrets(dopplerToken2, name, 'dev', analyticsSecrets)
    }

    // Update fleet_apps with provisioned analytics IDs
    if (gaPropertyId || gaMeasurementId) {
      await db
        .update(fleetApps)
        .set({
          ...(gaPropertyId ? { gaPropertyId } : {}),
          ...(gaMeasurementId ? { gaMeasurementId } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(fleetApps.name, name))
    }
  } catch (err: unknown) {
    // Analytics failures are non-fatal — log but continue
    const error = err as { message?: string }
    console.warn(`Analytics provisioning warning: ${error.message}`)
  }

  // ── 10. Dispatch provision-app.yml ──
  await updateStatus(provisionId, 'dispatching')

  const templateRepo = 'narduk-enterprises/narduk-nuxt-template'

  try {
    await triggerWorkflow(ghToken, templateRepo, 'provision-app.yml', {
      'app-name': name,
      'display-name': displayName,
      'app-url': url,
      'github-repo': githubRepo,
      'provision-id': provisionId,
      // Pre-provisioned IDs — init.ts can skip these steps
      'd1-database-id': d1DatabaseId,
      'd1-database-name': d1DatabaseName,
      'ga-property-id': gaPropertyId,
      'ga-measurement-id': gaMeasurementId,
      'gsc-verification-file': gscVerificationFileName,
      'gsc-verification-content': gscVerificationContent,
      'indexnow-key': indexNowKey,
    })

    await updateStatus(provisionId, 'provisioning')
  } catch (err: unknown) {
    const error = err as { message?: string }
    await updateStatus(provisionId, 'failed', {
      errorMessage: `Workflow dispatch: ${error.message}`,
    })
    throw createError({
      statusCode: 502,
      message: `Workflow dispatch failed: ${error.message}`,
    })
  }

  return {
    ok: true,
    provisionId,
    app: name,
    githubRepo,
    status: 'provisioning',
    infrastructure: {
      d1DatabaseId,
      d1DatabaseName,
      gaPropertyId: gaPropertyId || null,
      gaMeasurementId: gaMeasurementId || null,
      indexNowKey: indexNowKey || null,
    },
    message: `App '${name}' registered and provisioning started. All infrastructure pre-provisioned. Poll GET /api/fleet/provision/${provisionId} for status.`,
  }
})
