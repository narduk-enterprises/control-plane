---
name: nuxt-workspace-testing
description:
  Runs and adds tests for this PNPM monorepo (Playwright E2E, Vitest
  integration, hydration smoke). Use when the user asks to write, run, fix, or
  debug tests; when adding features that need coverage; or when working in
  apps/web/tests or Playwright/Vitest configs.
---

# Nuxt workspace testing (control-plane)

## Stack and layout

| Layer       | Tool        | Location / command                                                              |
| ----------- | ----------- | ------------------------------------------------------------------------------- |
| E2E         | Playwright  | Root `playwright.config.ts`; tests in `apps/web/tests/e2e/`                     |
| Integration | Vitest      | `apps/web/vitest.config.ts`; tests in `apps/web/tests/integration/**/*.test.ts` |
| Hydration   | Node script | `pnpm --filter web test:hydration`                                              |

## Commands (run from repo root)

- **E2E:** `pnpm test:e2e` — starts or reuses dev server (`pnpm run dev` →
  `http://localhost:3000`), runs the `web` project.
- **E2E single file / grep:**
  `pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts` or
  `--grep "label"`.
- **Integration:** `pnpm --filter web test:integration`
- **Hydration smoke:** `pnpm --filter web test:hydration`

## Agent expectations

1. **New behavior:** Add or extend tests in the right layer (unit/integration
   logic → Vitest; user flows → Playwright). Prefer stable locators
   (`getByRole`, `getByLabel`) over brittle CSS.
2. **E2E environment:** Tests should tolerate local dev and CI
   (`reuseExistingServer: true` in config). Do not assume a single long-running
   server without checking config.
3. **After test changes:** Run the narrowest command that proves the fix (single
   spec or `vitest run` path) before full suite.
4. **Quality gate:** This repo expects `pnpm run quality` to pass; do not
   introduce lint/type errors in test files.

## Cloudflare / Nuxt constraints (server & E2E)

- Server code under test must stay compatible with the Workers model (no
  Node-only APIs in routes under test).
- For pages under E2E, respect SSR: avoid timing flakes from hydration — wait
  for network idle or explicit selectors, not arbitrary `sleep` unless
  unavoidable.

## Optional deep dives

- Root testing recipe: `AGENTS.md` (Recipe: Testing).
- App-specific scripts: `apps/web/package.json` (`test:integration`,
  `test:hydration`).
