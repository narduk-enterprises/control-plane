import { describe, expect, it } from 'vitest'
import { detailNeedsFollowUpRefresh, summaryNeedsFollowUpRefresh } from '../../app/stores/analytics'
import type {
  AnalyticsProviderSnapshot,
  FleetAnalyticsDetailResponse,
  FleetAnalyticsSummaryResponse,
} from '../../app/types/analytics'

function providerSnapshot(
  overrides: Partial<AnalyticsProviderSnapshot<unknown>> = {},
): AnalyticsProviderSnapshot<unknown> {
  return {
    status: 'healthy',
    source: 'live',
    stale: false,
    lastUpdatedAt: '2026-03-22T23:00:00.000Z',
    message: null,
    metrics: {},
    ...overrides,
  }
}

function detailSnapshot(
  overrides: Partial<FleetAnalyticsDetailResponse> = {},
): FleetAnalyticsDetailResponse {
  return {
    app: {
      name: 'demo-app',
      url: 'https://demo.example.com',
      dopplerProject: 'demo-app',
      gaPropertyId: '123456',
      gaMeasurementId: 'G-DEMO123',
      posthogAppName: 'demo-app',
      githubRepo: 'narduk/demo-app',
      isActive: true,
    },
    range: {
      startDate: '2026-03-15',
      endDate: '2026-03-22',
    },
    generatedAt: '2026-03-22T23:00:00.000Z',
    health: {
      status: 'up',
      checkedAt: '2026-03-22T23:00:00.000Z',
    },
    ga: providerSnapshot(),
    gsc: providerSnapshot(),
    posthog: providerSnapshot(),
    indexnow: providerSnapshot(),
    ...overrides,
  }
}

describe('analytics store follow-up refresh logic', () => {
  it('flags detail snapshots with stale providers for a follow-up refresh', () => {
    const detail = detailSnapshot({
      ga: providerSnapshot({
        status: 'stale',
        source: 'cache',
        stale: true,
        message: 'GA4 data is stale and is refreshing in the background.',
      }),
    })

    expect(detailNeedsFollowUpRefresh(detail)).toBe(true)
  })

  it('ignores healthy no-data detail snapshots', () => {
    const detail = detailSnapshot({
      ga: providerSnapshot({
        status: 'no_data',
        source: 'cache',
        stale: false,
        message: 'GA4 returned no traffic for the selected range.',
      }),
    })

    expect(detailNeedsFollowUpRefresh(detail)).toBe(false)
  })

  it('flags summary snapshots when any app contains a stale provider', () => {
    const staleDetail = detailSnapshot({
      app: {
        name: 'stale-app',
        url: 'https://stale.example.com',
        dopplerProject: 'stale-app',
        gaPropertyId: '234567',
        gaMeasurementId: 'G-STALE123',
        posthogAppName: 'stale-app',
        githubRepo: 'narduk/stale-app',
        isActive: true,
      },
      ga: providerSnapshot({
        status: 'stale',
        source: 'cache',
        stale: true,
      }),
    })
    const healthyDetail = detailSnapshot()

    const summary: FleetAnalyticsSummaryResponse = {
      startDate: '2026-03-15',
      endDate: '2026-03-22',
      generatedAt: '2026-03-22T23:00:00.000Z',
      apps: {
        healthy: healthyDetail,
        stale: staleDetail,
      },
      totals: {
        gaUsers: 10,
        gaPageviews: 20,
        gscClicks: 5,
        gscImpressions: 100,
        posthogEvents: 30,
        posthogUsers: 7,
        healthyProviders: {
          ga: 1,
          gsc: 2,
          posthog: 2,
          indexnow: 0,
        },
        problemProviders: {
          ga: 1,
          gsc: 0,
          posthog: 0,
          indexnow: 0,
        },
      },
      insights: [],
    }

    expect(summaryNeedsFollowUpRefresh(summary)).toBe(true)
  })
})
