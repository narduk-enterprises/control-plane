import { test, expect } from '@playwright/test'

/**
 * SSR Hydration Validation Tests
 *
 * This suite visits core pages in the application and checks the browser console
 * for Vue Hydration mismatch warnings. If any hydration mismatch occurred during
 * the server-render to client-mount phase, it will fail the test.
 */
test.describe('SSR Hydration Safety Checks', () => {
  // Core application routes to check for hydration mismatches
  const routesToCheck = ['/', '/fleet', '/fleet/neon-sewer-raid', '/settings']

  for (const route of routesToCheck) {
    test(`Check hydration on ${route}`, async ({ page }) => {
      const hydrationErrors: string[] = []

      // Listen to all console events and capture Vue Hydration warnings
      page.on('console', (msg) => {
        const text = msg.text()
        if (
          text.includes('Hydration') ||
          text.includes('Hydration class mismatch') ||
          text.includes('Hydration children mismatch')
        ) {
          hydrationErrors.push(text)
        }
      })

      // Listen for unhandled page errors just in case
      page.on('pageerror', (error) => {
        if (error.message.includes('Hydration')) {
          hydrationErrors.push(error.message)
        }
      })

      // Visit the route and wait for the network to be idle to ensure full hydration
      await page.goto(route, { waitUntil: 'networkidle' })

      // Give Vue a moment to finish its reactive tick
      await page.waitForTimeout(1000)

      // Assert that no hydration warnings were captured
      expect(
        hydrationErrors,
        `Hydration mismatches found on ${route}: \n${hydrationErrors.join('\n')}`,
      ).toEqual([])
    })
  }
})
