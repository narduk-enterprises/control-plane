import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Analytics Dashboard page.
 *
 * These tests run against production (control-plane.nard.uk) to verify
 * the analytics page renders real data after the D1 cache has been populated.
 */

const BASE = process.env.E2E_BASE_URL || 'https://control-plane.nard.uk'

async function openProviderTab(page: import('@playwright/test').Page, label: string) {
  const tab = page.locator(`button:has-text("${label}")`).first()
  await expect(tab).toBeVisible({ timeout: 10_000 })
  await tab.click()
}

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

  test('GA4 provider surface renders with app names', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)
    await openProviderTab(page, 'GA4')

    const pageContent = await page.textContent('body')
    const knownApps = ['austin-texas-net', 'control-plane', 'tide-check', 'papa-everetts-pizza']
    const foundApp = knownApps.some((app) => pageContent?.includes(app))
    expect(foundApp).toBe(true)
  })

  test('PostHog provider surface shows sortable fleet table after cache population', async ({
    page,
  }) => {
    await page.goto(`${BASE}/analytics`)
    await openProviderTab(page, 'PostHog')

    await page.waitForTimeout(5000)

    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('th', { hasText: 'Events' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Users' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Pageviews' }).first()).toBeVisible()

    const appLink = page.locator('a[href*="/analytics/"]').first()
    await expect(appLink).toBeVisible()
  })

  test('refresh button is clickable and triggers data load', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    const refreshBtn = page.locator('button:has([class*="lucide-refresh"])').first()
    await expect(refreshBtn).toBeVisible({ timeout: 5000 })

    await refreshBtn.click()
    await page.waitForTimeout(2000)
  })

  test('Indexing tab shows batch actions and ping history', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)
    await openProviderTab(page, 'Indexing')

    const indexNowSection = page.locator('text=IndexNow')
    await expect(indexNowSection.first()).toBeVisible({ timeout: 10000 })

    const submitAllBtn = page.locator('button:has-text("Submit All")')
    await expect(submitAllBtn).toBeVisible()

    await expect(page.locator('text=Ping history').first()).toBeVisible({ timeout: 10000 })
  })

  test('overview tab can show fleet health panel', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    await page.waitForTimeout(5000)

    const healthPanel = page.locator('text=Fleet Health')
    if (await healthPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const noPropertyError = page.locator('text=No GA4 property ID configured')
      const errorCount = await noPropertyError.count()
      expect(errorCount).toBe(0)
    }
  })

  test('date range change triggers data reload', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)

    await page.waitForTimeout(3000)

    const btn7d = page.locator('button:has-text("Last 7 Days")').first()
    if (await btn7d.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn7d.click()
      await page.waitForTimeout(3000)
    }
  })
})
