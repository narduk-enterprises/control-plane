import { test, expect, waitForHydration } from './fixtures'

test.describe('example-auth', () => {
  test('page loads without hydration errors on index', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Authentication' })).toBeVisible()
  })

  test('page loads without hydration errors on login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('page loads without hydration errors on register', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  })

  test('navigation from index to login and register', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Sign In' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  })

  test('login footer link goes to register', async ({ page }) => {
    await page.goto('/login')
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(/\/register/)
  })

  test('register footer link goes to login', async ({ page }) => {
    await page.goto('/register')
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login form validation shows errors for empty submit', async ({ page }) => {
    await page.goto('/login')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByText('Invalid email')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('register form validation shows errors for empty submit', async ({ page }) => {
    await page.goto('/register')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    // Validation should prevent submit: we stay on register, form still visible
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  })

  test('register form validation for short password', async ({ page }) => {
    await page.goto('/register')
    await waitForHydration(page)
    await page.getByPlaceholder('John Doe').fill('Test User')
    await page.getByPlaceholder('you@example.com').fill('test@example.com')
    await page.getByPlaceholder('••••••••').first().fill('short')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    // Validation should prevent submit: we stay on register
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  })

  test('full registration flow succeeds', async ({ page }) => {
    test.setTimeout(30_000)
    const email = `e2e-${Date.now()}@example.com`
    await page.goto('/register')
    await waitForHydration(page)
    await page.getByPlaceholder('John Doe').fill('E2E User')
    await page.getByPlaceholder('you@example.com').fill(email)
    await page.getByPlaceholder('••••••••').first().fill('password123')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Error' })).not.toBeVisible()
  })

  test('demo user login succeeds', async ({ page }) => {
    test.setTimeout(30_000)
    await page.goto('/login')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Sign In as Demo User' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Error' })).not.toBeVisible()
  })

  test('demo user login from index page succeeds', async ({ page }) => {
    test.setTimeout(30_000)
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Try Demo User' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    test.setTimeout(15_000)
    await page.goto('/login')
    await waitForHydration(page)
    await page.getByPlaceholder('you@example.com').fill('wrong@example.com')
    await page.getByPlaceholder('••••••••').first().fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(
      page.getByText('Invalid email or password'),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('duplicate registration shows error', async ({ page }) => {
    test.setTimeout(30_000)
    const email = `e2e-dup-${Date.now()}@example.com`
    await page.goto('/register')
    await waitForHydration(page)
    await page.getByPlaceholder('John Doe').fill('First User')
    await page.getByPlaceholder('you@example.com').fill(email)
    await page.getByPlaceholder('••••••••').first().fill('password123')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

    // Clear cookies to start fresh (avoids guest middleware redirect issues)
    await page.context().clearCookies()

    await page.goto('/register')
    await waitForHydration(page)
    await page.getByPlaceholder('John Doe').fill('Second User')
    await page.getByPlaceholder('you@example.com').fill(email)
    await page.getByPlaceholder('••••••••').first().fill('password456')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await expect(page.getByText('already in use')).toBeVisible({ timeout: 5_000 })
  })
})
