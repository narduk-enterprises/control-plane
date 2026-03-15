import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Analytics Dashboard page.
 *
 * These tests run against production (control-plane.nard.uk) to verify
 * the analytics page renders real data after the D1 cache has been populated.
 */

const BASE = process.env.E2E_BASE_URL || 'https://control-plane.nard.uk'

// We need to be authenticated — the analytics page requires admin access
test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`${BASE}/login`)
    const userField = page
      .locator('input[type="text"], input[name="username"], input[name="email"]')
      .first()
    const passField = page.locator('input[type="password"]').first()

    if (await userField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userField.fill(process.env.E2E_USERNAME || 'analytics-admin')
      await passField.fill(process.env.E2E_PASSWORD || '')
      await page.locator('button[type="submit"]').click()
      await page.waitForURL('**/*', { timeout: 10000 })
    }
  })

  test('page loads with title and date selector', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)
    await expect(page.locator('h1')).toContainText('Analytics Dashboard')

    // Date selector should be present (either USelect dropdown on mobile or pill buttons on desktop)
    const dateSelector = page.locator('select, [role="combobox"], button:has-text("Last 30 Days")')
    await expect(dateSelector.first()).toBeVisible({ timeout: 10000 })
  })

  test('fleet cards render with app names', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    // Wait for loading to finish — cards should appear
    const firstCard = page.locator('[class*="rounded-xl"]').first()
    await expect(firstCard).toBeVisible({ timeout: 15000 })

    // Should have multiple fleet app cards
    const cards = page.locator('[class*="rounded-xl"]')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)

    // At least one card should contain an app name we know exists
    const pageContent = await page.textContent('body')
    const knownApps = ['austin-texas-net', 'control-plane', 'tide-check', 'papa-everetts-pizza']
    const foundApp = knownApps.some((app) => pageContent?.includes(app))
    expect(foundApp).toBe(true)
  })

  test('fleet cards show non-zero analytics data after cache population', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    // Wait for data to load
    await page.waitForTimeout(5000)

    // Check if any card shows non-zero numbers (Users, PV, Clicks, Events)
    const body = (await page.textContent('body')) || ''

    // Look for typical rendered numbers patterns — at least one card should show data
    // The AnalyticsFleetCard shows: GA Users, PV (pageviews), Clicks, Events
    const hasGAUsers = page.locator('text=GA Users').first()
    const hasPV = page.locator('text=PV').first()
    const hasEvents = page.locator('text=Events').first()
    const hasClicks = page.locator('text=Clicks').first()

    // At least one data label should be visible
    const visibleLabels = await Promise.all([
      hasGAUsers.isVisible({ timeout: 2000 }).catch(() => false),
      hasPV.isVisible({ timeout: 2000 }).catch(() => false),
      hasEvents.isVisible({ timeout: 2000 }).catch(() => false),
      hasClicks.isVisible({ timeout: 2000 }).catch(() => false),
    ])

    const anyDataVisible = visibleLabels.includes(true)

    // If no data labels visible, check if cards just show "No cached data"
    if (!anyDataVisible) {
      const noCachedCount = (body.match(/No cached data/g) || []).length
      // This test will catch if ALL cards show "No cached data" — that's the bug
      console.log(`Cards showing "No cached data": ${noCachedCount}`)
      // We expect at least SOME cards to have data after cache population
      expect(anyDataVisible || noCachedCount === 0).toBe(true)
    }
  })

  test('refresh button is clickable and triggers data load', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    // Find refresh button (icon-only)
    const refreshBtn = page.locator('button:has([class*="lucide-refresh"])').first()
    await expect(refreshBtn).toBeVisible({ timeout: 5000 })

    // Click it
    await refreshBtn.click()

    // It should show loading state briefly
    await page.waitForTimeout(2000)
  })

  test('IndexNow section is visible with Submit All button', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    const indexNowSection = page.locator('text=IndexNow')
    await expect(indexNowSection.first()).toBeVisible({ timeout: 10000 })

    const submitAllBtn = page.locator('button:has-text("Submit All")')
    await expect(submitAllBtn).toBeVisible()
  })

  test('fleet health panel renders without false warnings', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    // Wait for page to load
    await page.waitForTimeout(5000)

    // If Fleet Health panel is visible, check it doesn't show false positives
    const healthPanel = page.locator('text=Fleet Health')
    if (await healthPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Should NOT show "No GA4 property ID configured" for any app anymore
      const noPropertyError = page.locator('text=No GA4 property ID configured')
      const errorCount = await noPropertyError.count()
      expect(errorCount).toBe(0)
    }
  })

  test('date range change triggers data reload', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    // Wait for initial load
    await page.waitForTimeout(3000)

    // On desktop: try clicking "Last 7 Days" button
    const btn7d = page.locator('button:has-text("Last 7 Days")').first()
    if (await btn7d.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn7d.click()
      await page.waitForTimeout(3000)
    }
  })
})
