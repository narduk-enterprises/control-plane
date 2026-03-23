import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetApps } from '#server/data/fleet-registry'
import {
  buildFleetAnalyticsSummary,
  reconcileAuditMeasurementIds,
} from '#server/utils/fleet-analytics'
import { getDopplerSecrets } from '#server/utils/provision-doppler'
import {
  buildAnalyticsProviderChecks,
  buildAuditChecks,
  buildSelfAuditSignals,
  extractAuditSignalsFromHtml,
  shouldUseSelfAudit,
  type AuditReconcileCandidate,
  type AuditResult,
} from '#server/utils/fleet-audit'

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
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'fleet-audit', 10, 60_000)
  await requireAdmin(event)

  const bodyInput = await readBody(event).catch(() => null)
  const body = bodySchema.safeParse(bodyInput)
  const persist = body.success ? body.data?.persist === true : false

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
    results: results.sort((left, right) => left.app.localeCompare(right.app)),
    reconcile: {
      mode: persist ? 'write' : 'dry-run',
      updatedCount,
      candidates: reconcileCandidates.sort((left, right) => left.app.localeCompare(right.app)),
    },
  }
})
