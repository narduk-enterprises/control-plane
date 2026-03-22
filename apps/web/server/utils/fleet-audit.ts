import type { H3Event } from 'h3'
import type { FleetApp } from '#server/database/schema'
import type {
  AnalyticsProviderSnapshot,
  AnalyticsProviderStatus,
  FleetAnalyticsGaMetrics,
  FleetAnalyticsGscMetrics,
} from '~/types/analytics'

export interface AuditCheck {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'skipped'
  expected: string | null
  actual: string | null
  message: string
}

export interface AuditResult {
  app: string
  url: string
  checks: AuditCheck[]
  fetchError?: string
}

export interface AuditReconcileCandidate {
  app: string
  previousMeasurementId: string | null
  liveMeasurementId: string
}

export interface AuditSignals {
  appName: string | null
  gaMeasurementId: string | null
  posthogPublicKey: string | null
  title: string | null
}

type AuditAnalyticsSnapshot = {
  ga: AnalyticsProviderSnapshot<FleetAnalyticsGaMetrics>
  gsc: AnalyticsProviderSnapshot<FleetAnalyticsGscMetrics>
}

interface SelfAuditConfig {
  appName?: string | null
  gaMeasurementId?: string | null
  posthogPublicKey?: string | null
}

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function extractAuditSignalsFromHtml(html: string): AuditSignals {
  return {
    appName: normalizeString(html.match(/appName["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? null),
    gaMeasurementId: normalizeString(
      html.match(/gaMeasurementId["']?\s*[:=]\s*["'](G-[A-Z0-9]+)["']/i)?.[1] ?? null,
    ),
    posthogPublicKey: normalizeString(
      html.match(/posthogPublicKey["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? null,
    ),
    title: normalizeString(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null),
  }
}

export function buildSelfAuditSignalsFromConfig(config: SelfAuditConfig): AuditSignals {
  const appName = normalizeString(config.appName) ?? 'Narduk Control Plane'

  return {
    appName,
    gaMeasurementId: normalizeString(config.gaMeasurementId),
    posthogPublicKey: normalizeString(config.posthogPublicKey),
    title: `${appName} Dashboard`,
  }
}

export function buildSelfAuditSignals(event: H3Event): AuditSignals {
  const config = useRuntimeConfig(event)

  return buildSelfAuditSignalsFromConfig({
    appName: normalizeString(String(config.public.appName || '')),
    gaMeasurementId: normalizeString(String(config.public.gaMeasurementId || '')),
    posthogPublicKey: normalizeString(String(config.public.posthogPublicKey || '')),
  })
}

export function shouldUseSelfAudit(event: H3Event, app: FleetApp): boolean {
  const config = useRuntimeConfig(event)
  const controlPlaneUrl = normalizeString(String(config.public.appUrl || ''))

  return (
    app.name === 'control-plane' ||
    (controlPlaneUrl !== null && normalizeString(app.url) === controlPlaneUrl)
  )
}

export function buildAuditChecks(
  app: FleetApp,
  signals: AuditSignals,
): { checks: AuditCheck[]; reconcileCandidate?: AuditReconcileCandidate } {
  const checks: AuditCheck[] = []
  const actualPhKey = signals.posthogPublicKey
  const actualAppName = signals.appName
  const actualGaId = signals.gaMeasurementId
  const expectedGaId = normalizeString(app.gaMeasurementId)
  const title = signals.title

  checks.push({
    name: 'PostHog API Key',
    status: actualPhKey ? 'pass' : 'warning',
    expected: null,
    actual: actualPhKey,
    message: actualPhKey
      ? `Found PostHog key: ${actualPhKey.slice(0, 12)}...`
      : 'No posthogPublicKey found in serialized runtime config',
  })

  checks.push({
    name: 'PostHog App Name',
    status: actualAppName ? 'pass' : 'warning',
    expected: null,
    actual: actualAppName,
    message: actualAppName
      ? `appName: "${actualAppName}"`
      : 'appName not found in serialized runtime config',
  })

  let reconcileCandidate: AuditReconcileCandidate | undefined
  if (actualGaId && actualGaId !== expectedGaId) {
    reconcileCandidate = {
      app: app.name,
      previousMeasurementId: expectedGaId,
      liveMeasurementId: actualGaId,
    }
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
      status: actualGaId ? 'warning' : app.isActive ? 'warning' : 'skipped',
      expected: null,
      actual: actualGaId,
      message: actualGaId
        ? `Found "${actualGaId}" on site but fleet registry has no ga_measurement_id set`
        : app.isActive
          ? 'Active app has no ga_measurement_id configured in the fleet registry or deployed runtime'
          : 'No ga_measurement_id configured in fleet registry',
    })
  }

  checks.push({
    name: 'Page Title',
    status: title ? 'pass' : 'warning',
    expected: null,
    actual: title,
    message: title ? `Title: "${title}"` : 'No <title> tag found',
  })

  return { checks, reconcileCandidate }
}

function providerHealthAuditStatus(status: AnalyticsProviderStatus): AuditCheck['status'] {
  switch (status) {
    case 'healthy':
    case 'no_data':
      return 'pass'
    case 'stale':
      return 'warning'
    case 'missing_registry':
    case 'missing_config':
    case 'access_denied':
    case 'error':
      return 'fail'
  }
}

function providerHealthMessage(
  label: string,
  provider: AnalyticsProviderSnapshot<unknown>,
): string {
  if (provider.message) return provider.message

  switch (provider.status) {
    case 'healthy':
      return `${label} is healthy.`
    case 'no_data':
      return `${label} is configured but returned no data for the selected range.`
    case 'stale':
      return `${label} data is stale and is refreshing in the background.`
    case 'missing_registry':
      return `${label} is missing required fleet registry metadata.`
    case 'missing_config':
      return `${label} is missing required control-plane configuration.`
    case 'access_denied':
      return `${label} access is denied for the fleet service account.`
    case 'error':
      return `${label} returned an unexpected error.`
  }
}

export function buildAnalyticsProviderChecks(
  snapshot: AuditAnalyticsSnapshot | undefined,
): AuditCheck[] {
  if (!snapshot) return []

  return [
    {
      name: 'GA4 Provider Health',
      status: providerHealthAuditStatus(snapshot.ga.status),
      expected: 'healthy, no_data, or stale',
      actual: snapshot.ga.status,
      message: providerHealthMessage('GA4', snapshot.ga),
    },
    {
      name: 'Search Console Provider Health',
      status: providerHealthAuditStatus(snapshot.gsc.status),
      expected: 'healthy, no_data, or stale',
      actual: snapshot.gsc.status,
      message: providerHealthMessage('Search Console', snapshot.gsc),
    },
  ]
}
