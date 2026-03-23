import { describe, expect, it } from 'vitest'
import { formatAnalyticsFreshness } from '../../app/utils/analyticsFreshness'

describe('formatAnalyticsFreshness', () => {
  it('returns null when no timestamp is available', () => {
    expect(formatAnalyticsFreshness(null)).toBeNull()
  })

  it('formats fresh timestamps as just updated', () => {
    expect(
      formatAnalyticsFreshness('2026-03-23T19:41:25.000Z', Date.parse('2026-03-23T19:41:40.000Z')),
    ).toBe('Updated just now')
  })

  it('formats sub-hour timestamps in minutes', () => {
    expect(
      formatAnalyticsFreshness('2026-03-23T19:00:00.000Z', Date.parse('2026-03-23T19:18:00.000Z')),
    ).toBe('Updated 18 min ago')
  })

  it('returns a clock time for older timestamps', () => {
    expect(
      formatAnalyticsFreshness('2026-03-23T12:00:00.000Z', Date.parse('2026-03-23T19:18:00.000Z')),
    ).toMatch(/^Updated /)
  })
})
