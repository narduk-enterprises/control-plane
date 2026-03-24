import { describe, expect, it } from 'vitest'
import {
  buildAnalyticsInsightGroups,
  buildAnalyticsIssueGroups,
  normalizeAnalyticsSurface,
} from '../../app/utils/analyticsPresentation'
import type {
  AnalyticsInsight,
  AnalyticsProviderSnapshot,
  FleetAnalyticsSnapshot,
} from '../../app/types/analytics'
import type { FleetRegistryApp } from '../../app/types/fleet'

function providerSnapshot(
  overrides: Partial<AnalyticsProviderSnapshot<unknown>> = {},
): AnalyticsProviderSnapshot<unknown> {
  return {
    status: 'healthy',
    source: 'live',
    stale: false,
    lastUpdatedAt: '2026-03-23T00:00:00.000Z',
    message: null,
    metrics: {},
    ...overrides,
  }
}

function snapshot(
  name: string,
  overrides: Partial<FleetAnalyticsSnapshot> = {},
): FleetAnalyticsSnapshot {
  return {
    app: {
      name,
      url: `https://${name}.example.com`,
      dopplerProject: name,
      gaPropertyId: '123',
      gaMeasurementId: 'G-TEST123',
      posthogAppName: name,
      githubRepo: `narduk/${name}`,
      isActive: true,
    },
    range: { startDate: '2026-03-16', endDate: '2026-03-23' },
    generatedAt: '2026-03-23T00:00:00.000Z',
    health: { status: 'up', checkedAt: '2026-03-23T00:00:00.000Z' },
    ga: providerSnapshot(),
    gsc: providerSnapshot(),
    posthog: providerSnapshot(),
    indexnow: providerSnapshot(),
    ...overrides,
  }
}

describe('analytics presentation helpers', () => {
  it('normalizes unknown or missing surfaces back to overview', () => {
    expect(normalizeAnalyticsSurface()).toBe('overview')
    expect(normalizeAnalyticsSurface(null)).toBe('overview')
    expect(normalizeAnalyticsSurface('unknown')).toBe('overview')
    expect(normalizeAnalyticsSurface('posthog')).toBe('posthog')
  })

  it('groups repeated provider failures by provider and message', () => {
    const apps: FleetRegistryApp[] = [
      { name: 'alpha', url: 'https://alpha.example.com', dopplerProject: 'alpha', isActive: true },
      { name: 'beta', url: 'https://beta.example.com', dopplerProject: 'beta', isActive: true },
    ]

    const issueSnapshots: Record<string, FleetAnalyticsSnapshot | null> = {
      alpha: snapshot('alpha', {
        ga: providerSnapshot({
          status: 'missing_config',
          message: 'No GA4 property ID configured.',
        }),
      }),
      beta: snapshot('beta', {
        ga: providerSnapshot({
          status: 'missing_config',
          message: 'No GA4 property ID configured.',
        }),
      }),
    }

    const groups = buildAnalyticsIssueGroups(apps, issueSnapshots)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      label: 'GA4',
      surface: 'ga',
      appCount: 2,
      message: 'No GA4 property ID configured.',
    })
  })

  it('groups identical insight messages across multiple apps', () => {
    const insights: AnalyticsInsight[] = [
      {
        type: 'drop',
        severity: 'warning',
        appName: 'alpha',
        message: 'Traffic dropped sharply.',
        metric: 'gaUsers',
      },
      {
        type: 'drop',
        severity: 'warning',
        appName: 'beta',
        message: 'Traffic dropped sharply.',
        metric: 'gaUsers',
      },
    ]

    const groups = buildAnalyticsInsightGroups(insights)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      metric: 'gaUsers',
      appCount: 2,
      message: 'Traffic dropped sharply.',
    })
  })
})
