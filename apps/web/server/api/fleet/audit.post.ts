import { z } from 'zod'
import { defineAdminMutation, withOptionalValidatedBody } from '#layer/server/utils/mutation'
import { getFleetApps } from '#server/data/fleet-registry'
import {
  buildFleetAnalyticsSummary,
  reconcileAuditMeasurementIds,
} from '#server/utils/fleet-analytics'
import { getDopplerSecrets } from '#server/utils/provision-doppler'
import { buildFleetD1NamingChecks } from '#server/utils/fleet-d1-audit'
import {
  buildAnalyticsProviderChecks,
  buildAuditChecks,
  buildSelfAuditSignals,
  extractAuditSignalsFromHtml,
  shouldUseSelfAudit,
  type AuditReconcileCandidate,
  type AuditResult,
} from '#server/utils/fleet-audit'
import { listAllD1Databases } from '#server/utils/provision-cloudflare'

const bodySchema = z
  .object({
    persist: z.boolean().optional(),
  })
  .optional()

/**
 * POST /api/fleet/audit
 *
 * Dry-run by default. When { persist: true } is sent, live GA measurement IDs
 * discovered from deployed sites are written back to the fleet registry.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-audit', maxRequests: 10, windowMs: 60_000 },
    parseBody: withOptionalValidatedBody((raw) => {
      const parsed = bodySchema.safeParse(raw)
      const persist = parsed.success ? parsed.data?.persist === true : false
      return { persist }
    }, {}),
  },
  async ({ event, body }) => {
    const persist = body.persist

    const apps = await getFleetApps(event)
    const reconcileCandidates: AuditReconcileCandidate[] = []
    const auditEnd = new Date()
    const auditStart = new Date(auditEnd)
    auditStart.setDate(auditStart.getDate() - 7)
    const analyticsSummary = await buildFleetAnalyticsSummary(
      event,
      {
        startDate: auditStart.toISOString().slice(0, 10),
        endDate: auditEnd.toISOString().slice(0, 10),
      },
      false,
    ).catch((error) => {
      console.error('Fleet audit analytics summary failed:', error)
      return null
    })
    const snapshotMap = analyticsSummary?.apps ?? {}

    const runtime = useRuntimeConfig(event)
    const cfAccountId = String(runtime.cloudflareAccountId || '').trim()
    const cfToken = String(runtime.cloudflareApiToken || '').trim()
    let d1Databases: Awaited<ReturnType<typeof listAllD1Databases>> | null = null
    let d1ListError: string | null = null
    if (cfAccountId && cfToken) {
      try {
        d1Databases = await listAllD1Databases(cfAccountId, cfToken)
      } catch (error: unknown) {
        d1ListError = error instanceof Error ? error.message : String(error)
        console.error('Fleet audit D1 list failed:', error)
      }
    }

    const results = await Promise.all(
      // eslint-disable-next-line narduk/no-map-async-in-server -- intentional parallel audit across the fleet
      apps.map(async (app): Promise<AuditResult> => {
        const providerChecks = buildAnalyticsProviderChecks(snapshotMap[app.name])

        if (shouldUseSelfAudit(event, app)) {
          const { checks, reconcileCandidate } = buildAuditChecks(app, buildSelfAuditSignals(event))
          if (reconcileCandidate) reconcileCandidates.push(reconcileCandidate)
          return { app: app.name, url: app.url, checks: [...checks, ...providerChecks] }
        }

        try {
          const response = await fetch(app.url, {
            headers: { 'User-Agent': 'NardukControlPlane-Auditor/2.0' },
            redirect: 'follow',
            signal: AbortSignal.timeout(15_000),
          })

          if (!response.ok) {
            return {
              app: app.name,
              url: app.url,
              checks: providerChecks,
              fetchError: `HTTP ${response.status} ${response.statusText}`,
            }
          }

          const html = await response.text()
          const { checks, reconcileCandidate } = buildAuditChecks(
            app,
            extractAuditSignalsFromHtml(html),
          )
          if (reconcileCandidate) reconcileCandidates.push(reconcileCandidate)
          return { app: app.name, url: app.url, checks: [...checks, ...providerChecks] }
        } catch (error: unknown) {
          return {
            app: app.name,
            url: app.url,
            checks: providerChecks,
            fetchError: error instanceof Error ? error.message : String(error),
          }
        }
      }),
    )

    const d1SkippedCheck = {
      name: 'D1 database naming (Cloudflare)',
      status: 'skipped' as const,
      expected: null,
      actual: null,
      message: d1ListError
        ? `Skipped: could not list D1 databases (${d1ListError})`
        : 'Skipped: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not configured on control plane',
    }

    const mergedResults = results.map((row): AuditResult => {
      const d1Checks = d1Databases
        ? buildFleetD1NamingChecks(row.app, d1Databases)
        : [d1SkippedCheck]
      return { ...row, checks: [...row.checks, ...d1Checks] }
    })

    let verifiedUpdates = reconcileCandidates.map((candidate) => ({
      app: candidate.app,
      gaMeasurementId: candidate.liveMeasurementId,
    }))

    if (persist) {
      const dopplerToken = useRuntimeConfig(event).dopplerApiToken
      if (dopplerToken) {
        const appsByName = new Map(apps.map((app) => [app.name, app]))
        const verified: Array<{ app: string; gaMeasurementId: string } | null> = []
        for (const candidate of verifiedUpdates) {
          const app = appsByName.get(candidate.app)
          if (!app) {
            verified.push(null)
            continue
          }

          try {
            const secrets = await getDopplerSecrets(dopplerToken, app.dopplerProject, 'prd')
            verified.push(
              secrets.GA_MEASUREMENT_ID?.trim() === candidate.gaMeasurementId ? candidate : null,
            )
          } catch {
            verified.push(null)
          }
        }

        verifiedUpdates = verified.filter((candidate) => candidate !== null)
      }
    }

    const updatedCount = persist ? await reconcileAuditMeasurementIds(event, verifiedUpdates) : 0

    return {
      results: mergedResults.sort((left, right) => left.app.localeCompare(right.app)),
      reconcile: {
        mode: persist ? 'write' : 'dry-run',
        updatedCount,
        candidates: reconcileCandidates.sort((left, right) => left.app.localeCompare(right.app)),
      },
    }
  },
)
