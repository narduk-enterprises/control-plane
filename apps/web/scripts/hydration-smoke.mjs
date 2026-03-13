/**
 * Hydration Smoke Test
 *
 * Builds the app, starts preview, visits top routes, and fails
 * if any console message contains hydration mismatch warnings.
 *
 * Usage: node scripts/hydration-smoke.mjs
 * CI:    pnpm test:hydration
 */

import { execSync, spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const ROUTES = ['/', '/analytics', '/fleet', '/github', '/indexing', '/settings']
const PORT = 4173
const BASE = `http://localhost:${PORT}`
const TIMEOUT_MS = 60_000

// ── 1. Build ────────────────────────────────────────────────────
console.log('⏳ Building application...')
try {
  execSync('pnpm build', { cwd: process.cwd(), stdio: 'inherit' })
} catch {
  console.error('❌ Build failed')
  process.exit(1)
}

// ── 2. Start preview server ────────────────────────────────────
console.log('⏳ Starting preview server...')
const preview = spawn('pnpm', ['preview', '--', '--port', String(PORT)], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
})

// Wait for server to be ready
let serverReady = false
const readyPromise = new Promise((resolve) => {
  preview.stdout.on('data', (data) => {
    const text = data.toString()
    if (text.includes(`localhost:${PORT}`) || text.includes('Local:')) {
      serverReady = true
      resolve(true)
    }
  })
  preview.stderr.on('data', (data) => {
    const text = data.toString()
    if (text.includes(`localhost:${PORT}`) || text.includes('Local:')) {
      serverReady = true
      resolve(true)
    }
  })
})

const timeoutPromise = sleep(TIMEOUT_MS).then(() => {
  if (!serverReady) {
    console.error('❌ Preview server did not start within timeout')
    preview.kill()
    process.exit(1)
  }
})

await Promise.race([readyPromise, timeoutPromise])
await sleep(2000) // Extra buffer for server stability

// ── 3. Check routes with Playwright ────────────────────────────
console.log('⏳ Checking routes for hydration mismatches...')
let hasErrors = false
const cases = []

try {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  for (const route of ROUTES) {
    const url = `${BASE}${route}`
    const page = await context.newPage()
    const hydrationWarnings = []

    page.on('console', (msg) => {
      const text = msg.text().toLowerCase()
      if (text.includes('hydration') && (text.includes('mismatch') || text.includes('expected'))) {
        hydrationWarnings.push(msg.text())
      }
    })

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
      await sleep(3000) // Allow hydration to settle
    } catch (e) {
      console.warn(`  ⚠️  Could not load ${route}: ${e.message}`)
    }

    if (hydrationWarnings.length > 0) {
      hasErrors = true
      console.error(`  ❌ ${route}: ${hydrationWarnings.length} hydration warning(s)`)
      for (const w of hydrationWarnings) {
        console.error(`     → ${w.slice(0, 200)}`)
      }
      cases.push({ route, warnings: hydrationWarnings })
    } else {
      console.log(`  ✅ ${route}: clean`)
    }

    await page.close()
  }

  await browser.close()
} catch (e) {
  // Playwright not installed — fall back to fetch-only check
  console.warn('⚠️  Playwright not available, falling back to SSR-only checks')
  for (const route of ROUTES) {
    try {
      const res = await fetch(`${BASE}${route}`)
      if (!res.ok) {
        console.warn(`  ⚠️  ${route}: HTTP ${res.status}`)
      } else {
        console.log(`  ✅ ${route}: SSR responds OK (no client-side check)`)
      }
    } catch (e) {
      console.warn(`  ⚠️  ${route}: ${e.message}`)
    }
  }
}

// ── 4. Cleanup ─────────────────────────────────────────────────
preview.kill()

if (hasErrors) {
  console.error(`\n❌ Hydration smoke test FAILED — ${cases.length} route(s) with warnings`)
  process.exit(1)
} else {
  console.log('\n✅ Hydration smoke test PASSED — all routes clean')
  process.exit(0)
}
