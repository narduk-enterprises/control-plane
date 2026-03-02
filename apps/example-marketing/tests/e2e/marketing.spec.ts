import { test, expect, waitForHydration } from './fixtures'

test.describe('example-marketing', () => {
  test('page loads without hydration errors', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Build at the speed of thought.')).toBeVisible({ timeout: 15_000 })
  })

  test('hero section renders with CTA buttons', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Build at the speed of thought.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('The ultimate edge-ready stack')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View on GitHub' })).toBeVisible()
  })

  test('all sections render', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Build at the speed of thought.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Pricing plans for teams/i)).toBeVisible()
    await expect(page.getByText('Contact sales')).toBeVisible()
  })

  test('pricing tiers visible with correct prices', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Build at the speed of thought.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Hobby' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible()
    await expect(page.getByText('$0')).toBeVisible()
    await expect(page.getByText('$29')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Buy plan' }).first()).toBeVisible()
  })

  test('pricing tiers show features list', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Build at the speed of thought.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('5 products', { exact: true })).toBeVisible()
    await expect(page.getByText('25 products')).toBeVisible()
    await expect(page.getByText('Advanced analytics')).toBeVisible()
    await expect(page.getByText('24-hour support response time')).toBeVisible()
  })

  test('pro tier has most popular badge', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Build at the speed of thought.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Most popular')).toBeVisible()
  })

  test('contact form validation', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('button', { name: "Let's talk" }).click()
    await expect(page.getByText(/first name|last name|invalid|at least/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('contact form success', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('heading', { name: 'Contact sales' }).scrollIntoViewIfNeeded()
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: "Let's talk" }) })
    await form.getByLabel(/first name/i).click()
    await page.keyboard.type('Jane')
    await form.getByLabel(/last name/i).click()
    await page.keyboard.type('Doe')
    await form.getByLabel(/email/i).click()
    await page.keyboard.type('jane@example.com')
    await form.getByLabel(/message/i).click()
    await page.keyboard.type('This is a test message with enough characters.')
    await form.getByRole('button', { name: "Let's talk" }).click()
    await expect(page.getByTestId('contact-success')).toBeVisible({ timeout: 15_000 })
  })

  test('contact form clears after successful submission', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('heading', { name: 'Contact sales' }).scrollIntoViewIfNeeded()
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: "Let's talk" }) })
    await form.getByLabel(/first name/i).click()
    await page.keyboard.type('Jane')
    await form.getByLabel(/last name/i).click()
    await page.keyboard.type('Doe')
    await form.getByLabel(/email/i).click()
    await page.keyboard.type('jane@example.com')
    await form.getByLabel(/message/i).click()
    await page.keyboard.type('This is a test message with enough characters.')
    await form.getByRole('button', { name: "Let's talk" }).click()
    await expect(page.getByTestId('contact-success')).toBeVisible({ timeout: 15_000 })
    // After success, form fields should be cleared
    await expect(form.getByLabel(/first name/i)).toHaveValue('')
  })

  test('theme toggle is present and visible', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Build at the speed of thought.')).toBeVisible({ timeout: 15_000 })
    const themeButton = page.locator('button').filter({ has: page.locator('span[class*="i-lucide-monitor"], span[class*="i-lucide-sun"], span[class*="i-lucide-moon"]') }).first()
    await expect(themeButton).toBeVisible()
  })

  test('page has correct title', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page).toHaveTitle(/Marketing/)
  })
})
