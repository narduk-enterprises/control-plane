import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { getFleetApps } from '#server/data/fleet-registry'
import { reconcileAuditMeasurementIds } from '#server/utils/fleet-analytics'

interface AuditCheck {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'skipped'
  expected: string | null
  actual: string | null
  message: string
}

interface AuditResult {
  app: string
  url: string
  checks: AuditCheck[]
  fetchError?: string
}

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
  await requireAdmin(event)

  const bodyInput = await readBody(event).catch(() => null)
  const body = bodySchema.safeParse(bodyInput)
  const persist = body.success ? body.data?.persist === true : false

  const apps = await getFleetApps(event)
  const reconcileCandidates: Array<{
    app: string
    previousMeasurementId: string | null
    liveMeasurementId: string
  }> = []

  const results = await Promise.all(
    // eslint-disable-next-line narduk/no-map-async-in-server -- intentional parallel audit across the fleet
    apps.map(async (app): Promise<AuditResult> => {
      let html = ''

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
            checks: [],
            fetchError: `HTTP ${response.status} ${response.statusText}`,
          }
        }

        html = await response.text()
      } catch (error: unknown) {
        return {
          app: app.name,
          url: app.url,
          checks: [],
          fetchError: error instanceof Error ? error.message : String(error),
        }
      }

      const checks: AuditCheck[] = []

      const actualPhKey =
        html.match(/posthogPublicKey["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? null
      checks.push({
        name: 'PostHog API Key',
        status: actualPhKey ? 'pass' : 'warning',
        expected: null,
        actual: actualPhKey,
        message: actualPhKey
          ? `Found PostHog key: ${actualPhKey.slice(0, 12)}...`
          : 'No posthogPublicKey found in serialized runtime config',
      })

      const actualAppName = html.match(/appName["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? null
      checks.push({
        name: 'PostHog App Name',
        status: actualAppName ? 'pass' : 'warning',
        expected: null,
        actual: actualAppName,
        message: actualAppName
          ? `appName: "${actualAppName}"`
          : 'appName not found in serialized runtime config',
      })

      const actualGaId =
        html.match(/gaMeasurementId["']?\s*[:=]\s*["'](G-[A-Z0-9]+)["']/i)?.[1] ?? null
      const expectedGaId = app.gaMeasurementId

      if (actualGaId && actualGaId !== expectedGaId) {
        reconcileCandidates.push({
          app: app.name,
          previousMeasurementId: expectedGaId ?? null,
          liveMeasurementId: actualGaId,
        })
      }

      if (expectedGaId) {
        checks.push({
          name: 'GA Measurement ID',
          status: actualGaId === expectedGaId ? 'pass' : actualGaId ? 'fail' : 'warning',
          expected: expectedGaId,
          actual: actualGaId,
          message:
            actualGaId === expectedGaId
              ? 'Matches fleet registry'
              : actualGaId
                ? `Mismatch: expected "${expectedGaId}", got "${actualGaId}"`
                : `Expected "${expectedGaId}" but not found — redeploy app to pick up GA_MEASUREMENT_ID`,
        })
      } else {
        checks.push({
          name: 'GA Measurement ID',
          status: actualGaId ? 'warning' : 'skipped',
          expected: null,
          actual: actualGaId,
          message:
            actualGaId
              ? `Found "${actualGaId}" on site but fleet registry has no ga_measurement_id set`
              : 'No ga_measurement_id configured in fleet registry',
        })
      }

      const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null
      checks.push({
        name: 'Page Title',
        status: title ? 'pass' : 'warning',
        expected: null,
        actual: title,
        message: title ? `Title: "${title}"` : 'No <title> tag found',
      })

      return { app: app.name, url: app.url, checks }
    }),
  )

  const updatedCount = persist
    ? await reconcileAuditMeasurementIds(
        event,
        reconcileCandidates.map((candidate) => ({
          app: candidate.app,
          gaMeasurementId: candidate.liveMeasurementId,
        })),
      )
    : 0

  return {
    results: results.sort((left, right) => left.app.localeCompare(right.app)),
    reconcile: {
      mode: persist ? 'write' : 'dry-run',
      updatedCount,
      candidates: reconcileCandidates.sort((left, right) => left.app.localeCompare(right.app)),
    },
  }
})
