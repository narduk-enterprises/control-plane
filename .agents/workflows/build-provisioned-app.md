---
description:
  Build an app in a freshly provisioned repo — verify infrastructure, build
  features, brand identity, SEO, and audit
---

# Build a Provisioned App

This workflow is for when you've been dropped into a freshly provisioned repo
(created via the control plane provision API or `pnpm run setup`). The
infrastructure is already done — your job is to **build the app**.

// turbo-all

## Step 1: Verify Infrastructure

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Run the validation suite:

   ```bash
   pnpm run validate
   ```

3. Run database migration:

   ```bash
   pnpm run db:migrate
   ```

4. Get the app name from `apps/web/package.json`:

   ```bash
   cat apps/web/package.json | grep '"name"' | head -1
   ```

5. Run quality check (use the app name from step 4):
   ```bash
   pnpm --filter <app-name> run quality
   ```

If quality passes with zero errors and zero warnings, proceed. If not, fix
issues first.

## Step 2: Read the Rules

1. Read `AGENTS.md` at the repo root — this is the canonical reference.
2. Read `tools/AGENTS.md` if it exists — tooling-specific guidance.

## Step 3: Understand What to Build

Ask the user what this app should do. If they've already told you (e.g., in the
initial prompt), proceed. Otherwise, ask:

> What should this app do? Please describe the features, pages, and any specific
> design requirements.

## Step 4: Build the App

Build all code inside `apps/web/`. Follow these critical patterns:

### Database Schema Extension Pattern

When adding app-specific tables beyond the layer's base schema:

1. **Create `apps/web/server/database/schema.ts`** — re-export the layer schema
   first, then define your app tables:

   ```ts
   export * from '#layer/server/database/schema'
   // App-specific tables below
   export const myTable = sqliteTable('my_table', { ... })
   ```

2. **Create `apps/web/server/utils/database.ts`** — export
   `useAppDatabase(event)` using the FULL schema:

   ```ts
   import { drizzle } from 'drizzle-orm/d1'
   import * as schema from '#server/database/schema'
   export function useAppDatabase(event: H3Event) {
     return drizzle(event.context.cloudflare.env.DB, { schema })
   }
   ```

3. **Use `useAppDatabase(event)` in ALL your server routes** — NEVER use the
   auto-imported `useDatabase` from the layer.

### Server Import Rule

Always use `#server/` aliases for server-to-server imports:

- ✅ `import { ... } from '#server/database/schema'`
- ✅ `import { useAppDatabase } from '#server/utils/database'`
- ❌ `import { ... } from '../../../database/schema'` (breaks `nuxt typecheck`)

### Migration Pattern

After creating or modifying the schema, add a new SQL migration file in
`apps/web/drizzle/` (e.g., `0001_app_tables.sql`).

### Quality Scope

Only run quality scoped to the app: `pnpm --filter <app-name> run quality`. Do
NOT run workspace-root quality — layer warnings are not your concern.

## Step 5: Brand Identity

Once the app is built and functional, follow the `/generate-brand-identity`
workflow (`.agents/workflows/generate-brand-identity.md`) end-to-end. You are
the creative director — analyze the app, make all creative decisions, and
execute the full pipeline.

### MANDATORY: Remove ALL Template Branding

1. **Remove the N4 icon.** Replace with the app's own logo.
2. **Remove or redesign the default navbar.** A navbar with just "Home" and a
   color toggle is unacceptable.
3. **Replace all placeholder text.** Search for "Nuxt 4", "N4", "Demo",
   "Template" in the UI.
4. **Light theme by default.** Set `colorMode: { preference: 'light' }` in
   `nuxt.config.ts`.

## Step 6: SEO Excellence

Every page MUST call both:

```ts
useSeo({
  title: '...',
  description: '...',
  ogImage: { title: '...', description: '...', icon: '🎯' },
})
useWebPageSchema({ name: '...', description: '...' })
```

Additional requirements:

- Rich, keyword-optimized titles and descriptions
- Semantic HTML5 elements (`<main>`, `<article>`, `<section>`, `<nav>`)
- Verify `sitemap.xml` and `robots.txt` generation
- Target relevant long-tail keywords

## Step 7: Quality Gate

Run the final quality check:

```bash
pnpm --filter <app-name> run quality
```

This MUST pass with **zero errors and zero warnings**. Do not use
`@ts-expect-error`, `eslint-disable`, or other suppressions.

## Step 8: Template Audit

Create `audit_report.md` in the repo root answering:

1. Did infrastructure verification work out of the box?
2. Did Drizzle migration and `nitro-cloudflare-dev` work?
3. Did Nuxt layer inheritance work seamlessly?
4. Any pre-existing TypeScript errors?
5. Did documentation accurately guide you?
6. Any HMR port collisions, Tailwind issues, or Doppler errors?

Be brutally honest — this feedback improves the template for everyone.
