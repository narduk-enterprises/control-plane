# AGENTS.md — AI Agent Instructions

> **🚨 CRITICAL: DO NOT PUSH TO `narduk-enterprises/narduk-nuxt-template` 🚨**
>
> This is a **read-only template repository**. Before writing ANY code, you MUST
> create your own repo:
>
> ```bash
> git clone https://github.com/narduk-enterprises/narduk-nuxt-template.git <project-name>
> cd <project-name>
> pnpm install
> ```
>
> **Verify your remote** with `git remote -v` — it must NOT point to
> `narduk-enterprises/narduk-nuxt-template`.

This is a **minimal Nuxt 4 + Nuxt UI 4** boilerplate deployed to **Cloudflare
Workers** with **D1 SQLite** (Drizzle ORM).

> **⚠️ ARCHITECTURE:** This repository is a **PNPM Workspace Monorepo**. Your
> application lives in `apps/web/` and consumes the shared layer at
> `layers/narduk-nuxt-layer/` (linked via
> `"@narduk-enterprises/narduk-nuxt-template-layer": "workspace:*"` in each
> app’s `package.json`; referenced in `nuxt.config.ts` as
> `extends: ['@narduk-enterprises/narduk-nuxt-template-layer']`). When building
> an app using this template, DO NOT recreate standard Nuxt UI components. Rely
> on the inherited layer.

## Glossary

| Term              | Meaning                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layer**         | A Nuxt Layer (`layers/narduk-nuxt-layer/`) — shared components, composables, plugins, server utils, and CSS that all apps inherit. Lives in `layers/`. Not deployed directly. |
| **Package**       | A workspace package (`packages/eslint-config/`) — standalone npm packages consumed by apps. Lives in `packages/`.                                                             |
| **Isolate**       | A Cloudflare Workers V8 isolate — a lightweight, stateless execution environment. Each request may hit a different isolate, so in-memory state is not shared across requests. |
| **Per-isolate**   | Scoped to a single V8 isolate instance. Per-isolate rate limiting, for example, only tracks requests within one isolate's memory.                                             |
| **Hub project**   | A Doppler project that stores shared infrastructure secrets (e.g. `narduk-nuxt-template`). You do NOT create these.                                                           |
| **Spoke project** | A Doppler project for a specific app that references hub secrets via cross-project references. Created by `init.ts` (via `pnpm run setup`).                                   |

For full-featured example implementations, see the **Showcase** apps in
`apps/showcase/`, `apps/example-auth/`, `apps/example-blog/`,
`apps/example-marketing/`, `apps/example-og-image/`, and
`apps/example-apple-maps/`.

## Project Structure (PNPM Workspace)

This repository functions as a single **PNPM Workspace** managing the web
application, showcase examples, and supporting packages. The shared layer is
consumed as an npm dependency.

```
pnpm-workspace.yaml        # Workspace root config
package.json               # Global scripts (pnpm run dev, pnpm run quality)
AGENTS.md                  # Global AI coding guidelines
.agents/                   # Saved AI workflows (invoked via /slash-commands)
apps/
  web/                     # The main Nuxt 4 application
    app/                   # App UI (pages, components, layouts)
    server/                # Edge API endpoints and D1 database handling
    nuxt.config.ts         # Extends @narduk-enterprises/narduk-nuxt-template-layer
  showcase/                # Landing page with links to each example app
  example-auth/            # Auth example (independent worker)
  example-blog/            # Blog example (independent worker)
  example-marketing/       # Marketing UI example (independent worker)
  example-og-image/        # OG image generation example
  example-apple-maps/      # Apple Maps integration example
layers/
  narduk-nuxt-layer/       # Shared Nuxt Layer (also published as npm package)
packages/
  eslint-config/           # Workspace ESLint plugins (run pnpm build:plugins after changes)
tools/                     # Node.js automation scripts (init, validate, analytics) — NOT edge code
scripts/                   # Shell helper scripts (dev-kill, run-dev-auth)
```

## Where YOUR Code Goes

- **`apps/web/`** — This is the **ONLY** directory you should modify during a
  migration or new project.
- **`apps/example-*`** and **`apps/showcase/`** — Read-only reference
  implementations. **Delete them** for production projects.
- **`layers/narduk-nuxt-layer/`** — Only modify if creating a generic, reusable
  feature for ALL Narduk apps.
- **`packages/eslint-config/`** — Only modify if adding or editing ESLint rules.

_You can create `app/components/`, `server/api/`, etc., in `apps/web/`, but
ensure you aren't duplicating something already provided by the Layer (see Layer
Manifest below)._

## What the Layer Provides (DO NOT Duplicate)

The layer at `layers/narduk-nuxt-layer/` provides all of the following
out-of-the-box. **Do not copy or recreate these in your app.**

| Category        | Files                                                                              | What You Get                                                                          |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Modules**     | `nuxt.config.ts`                                                                   | `@nuxt/ui`, `@nuxt/fonts`, `@nuxt/image`, `@nuxtjs/seo`, `@nuxt/eslint`               |
| **Nitro**       | `nuxt.config.ts`                                                                   | `cloudflare-module` preset, esbuild target, Drizzle inline                            |
| **UI/Color**    | `nuxt.config.ts` + `app/app.config.ts`                                             | colorMode, ogImage defaults, image provider                                           |
| **SEO**         | `app/composables/useSeo.ts`, `useSchemaOrg.ts`                                     | `useSeo()`, `useWebPageSchema()`, `useArticleSchema()`, etc.                          |
| **OG Images**   | `app/components/OgImage/*`                                                         | Dynamic OG image templates (Satori)                                                   |
| **Analytics**   | `app/plugins/gtag.client.ts`, `posthog.client.ts`                                  | PostHog + GA4 (no-op without keys)                                                    |
| **CSRF**        | `app/plugins/fetch.client.ts`, `server/middleware/csrf.ts`                         | Auto `X-Requested-With` header + server validation                                    |
| **Security**    | `server/middleware/cors.ts`, `securityHeaders.ts`                                  | CORS, CSP, X-Frame-Options, Referrer-Policy                                           |
| **Rate Limit**  | `server/utils/rateLimit.ts`                                                        | Per-isolate sliding-window IP limiter                                                 |
| **Database**    | `server/utils/database.ts`, `server/middleware/d1.ts`, `server/database/schema.ts` | D1 bindings, Drizzle connection, base schema (`nitro-cloudflare-dev` required in app) |
| **Storage**     | `server/utils/kv.ts`, `server/utils/r2.ts`                                         | KV and R2 binding helpers                                                             |
| **Auth**        | `server/utils/auth.ts`                                                             | `requireAdmin`, PBKDF2 password hashing                                               |
| **Health**      | `server/api/health.get.ts`                                                         | `/api/health` endpoint                                                                |
| **IndexNow**    | `server/api/indexnow/*`, `server/middleware/indexnow.ts`                           | IndexNow submission + key verification                                                |
| **Error Pages** | `app/error.vue`                                                                    | Branded global error pages (404/500)                                                  |
| **Base CSS**    | `app/assets/css/main.css`                                                          | Tailwind v4 `@theme` tokens, glass/card utilities                                     |
| **App Shell**   | `app/app.vue`, `app/app.config.ts`                                                 | `<UApp>` wrapper, color token defaults                                                |

### Showcase Architecture

Each example app is a fully independent Cloudflare Worker with its own domain.
The `apps/showcase/` app is a simple landing page that links to each example
(opens in a new tab). There is no routing proxy or Service Bindings — each app
is self-contained and can be developed and deployed independently.

To add a new example app:

1. Create `apps/example-<name>/` with its own `nuxt.config.ts` and
   `wrangler.json`
2. Set the `EXAMPLE_<NAME>_URL` env var in the showcase's runtime config
3. Add a card to `apps/showcase/app/pages/index.vue`

**Dev and seed data:** Apps that use D1 (example-auth, example-blog) run
`db:ready` (migrate + seed) before `nuxt dev`, so the local D1 database is
always created and populated with seed data when you start dev. From the repo
root you can run `pnpm db:ready:auth` to prepare the auth example DB before
`pnpm dev:showcase`.

> **⚠️ Local D1 Requirement:** The app must explicitly install
> `nitro-cloudflare-dev` and register it in `nuxt.config.ts` (pointing
> `nitro.cloudflareDev.configPath` to the app's `wrangler.json`) to provide the
> local D1 proxy to the dev server. Without this, server routes will fail to
> access the database during development.

### Updating the Layer

To pull the latest layer fixes and features from the template repository:

```bash
pnpm run update-layer
```

**What this does under the hood:**

1. Adds or updates a `template` Git remote pointing to
   `https://github.com/narduk-enterprises/narduk-nuxt-template.git`.
2. Fetches `main` from the template.
3. Checks out the `layers/narduk-nuxt-layer` directory from `template/main`,
   overwriting the local layer directory.
4. Rewrites `layers/narduk-nuxt-layer/package.json` so its `repository.url`
   points to _your_ app's origin instead of the template's, preventing identity
   drift.
5. Runs `pnpm install` to sync any new layer dependencies with the workspace
   lockfile.

> **⚠️ WARNING: Local Overwrites**  
> This script will unconditionally overwrite `layers/narduk-nuxt-layer`. Any
> customizations you've made directly to the layer code in your repository will
> be discarded. You will need to use your Git staging interface (e.g.,
> `git diff` or VS Code Source Control) to review the incoming changes and
> merge/restore your local modifications before committing.

## Hard Constraints (Cloudflare Workers)

- **NO Node.js modules** — no `fs`, `path`, `crypto`, `bcrypt`, `child_process`
- **Use Web Crypto API** — `crypto.subtle` for all hashing (PBKDF2)
- **Nitro preset** is `cloudflare-module` (ES Module format, V8 isolates)
- **Drizzle ORM only** — no Prisma or other Node-dependent ORMs
- **Drizzle `sql` gotcha** — in `sql` template literals, `${table.column}` is
  parameterized as a **value** (bind parameter), not a column reference. This
  causes silent bugs in correlated subqueries (e.g. always-zero counts). Use
  `Promise.all` with individual queries instead of correlated subqueries, or use
  Drizzle's relational query API.
- All server code must be stateless across requests (edge isolate model)

## Security & Protection

The layer provides three security layers out of the box:

### Rate Limiting (Two-Tier)

**Tier 1 — Per-Isolate (built-in):** The layer includes
`server/utils/rateLimit.ts`, a sliding-window rate limiter that runs in each
Cloudflare Worker isolate's memory. Use it in API routes. **CRITICAL:** You MUST
call `enforceRateLimit(event)` on ALL mutation endpoints (POST/PUT/PATCH/DELETE)
to prevent systemic abuse:

```ts
await enforceRateLimit(event, 'auth', 10, 60_000) // 10 requests/minute per IP
```

> **⚠️ Important:** This is per-isolate only — state is NOT shared across
> Workers. It protects against brute-force from a single client hitting the same
> isolate, but cannot enforce global limits.

### Request Validation (Zod)

The template strongly recommends using `readBody(event)` combined with Zod's
`.safeParse()` instead of `readValidatedBody` to ensure proper validation and
robust error handling on all mutations. Never consume unvalidated data from
`readBody()`.

**Tier 2 — Global (Cloudflare dashboard):** For production, complement the
per-isolate limiter with
[Cloudflare Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
configured in the Cloudflare dashboard or via Terraform. These enforce limits at
the edge before your Worker is invoked.

### CORS (API routes only)

The layer includes `server/middleware/cors.ts`. By default, no CORS headers are
sent (same-origin only). To allow cross-origin API access, set
`corsAllowedOrigins` in `runtimeConfig`:

```ts
runtimeConfig: {
  corsAllowedOrigins: 'https://app.example.com,https://admin.example.com',
}
```

- Only applies to `/api/*` routes
- Uses exact origin matching (no wildcards) for security
- Handles preflight OPTIONS requests automatically
- Sets `Vary: Origin` for proper caching

### CSRF Protection

The layer includes `server/middleware/csrf.ts` which blocks
POST/PUT/PATCH/DELETE requests missing the `X-Requested-With` header. The
client-side `fetch.client.ts` plugin automatically adds this header to all
requests. Routes under `/api/webhooks/`, `/api/cron/`, and `/api/callbacks/` are
excluded.

### Security Headers

The layer includes `server/middleware/securityHeaders.ts` which sets protective
HTTP headers on every response:

- **Content-Security-Policy** — restricts resource loading to trusted origins
  (self, Google Analytics, PostHog)
- **X-Content-Type-Options: nosniff** — prevents MIME-type sniffing
- **X-Frame-Options: DENY** — blocks framing (clickjacking protection)
- **Referrer-Policy: strict-origin-when-cross-origin** — limits referrer leakage
- **Permissions-Policy** — disables camera, microphone, and geolocation by
  default

## Nuxt UI 4 Rules

- `UDivider` → renamed to **`USeparator`** in v4
- Icons use `i-` prefix: `i-lucide-home`, not `name="heroicons-..."`
- Use design token colors (`primary`, `neutral`) not arbitrary color strings
- Tailwind CSS 4 — configure via `@theme` in `main.css`, not `tailwind.config`

## Design Tokens

The layer provides semantic design tokens via `@theme` in `main.css`. Use these
instead of hardcoded values:

| Category    | Tokens                                                                                                               | Usage                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Typography  | `--font-sans`, `--font-display`                                                                                      | Body text and headings |
| Shadows     | `--shadow-card`, `--shadow-elevated`, `--shadow-overlay`                                                             | Elevation hierarchy    |
| Radius      | `--radius-card`, `--radius-button`, `--radius-badge`, `--radius-input`                                               | Consistent rounding    |
| Transitions | `--transition-fast` (150ms), `--transition-base` (200ms), `--transition-slow` (300ms), `--transition-spring` (500ms) | Motion consistency     |

**Colors** are managed by Nuxt UI via `app.config.ts` — use Tailwind utilities
(`bg-primary`, `text-neutral-500`), never add color tokens to `@theme`.

**Utility classes:** `.glass`, `.glass-card`, `.card-base`, `.shadow-card`,
`.shadow-elevated`, `.shadow-overlay`, `.transition-fast`, `.transition-base`,
`.transition-slow`. All classes are dark-mode-aware.

## SEO (Required on Every Page)

Every page **must** call both:

```ts
useSeo({
  title: '...',
  description: '...',
  ogImage: { title: '...', description: '...', icon: '🎯' },
})
useWebPageSchema({ name: '...', description: '...' }) // or useArticleSchema, useProductSchema, etc.
```

Sitemap and robots.txt are automatic. OG image templates live in
`app/components/OgImage/`.

## Architecture Patterns

- **Commit often** — make small, focused commits after each meaningful change
  (new feature, bug fix, refactor). Do not accumulate large uncommitted
  changesets. Each commit message should follow Conventional Commits (`feat:`,
  `fix:`, `refactor:`, `chore:`, etc.).
- **Thin Components, Thick Composables** — components subscribe to composables,
  pass props down, emit events up. No inline fetch or complex logic in
  templates.
- **SSR-safe state** — use `useState()` or Pinia stores. Never use bare `ref()`
  at module scope (causes cross-request leaks).
- **Data fetching** — always use `useAsyncData` or `useFetch`, never raw
  `$fetch` in `<script setup>`.
- **Client-only code** — wrap `window`/`document` access in `onMounted` or
  `<ClientOnly>`.
- **Server imports** — when importing files inside `server/` (e.g., from
  `server/api/` to `server/database/schema.ts`), **use the `#server/` alias**
  (e.g., `import { ... } from '#server/database/schema'`) instead of relative
  paths like `../../../database/schema`. Relative imports cross the boundary
  between standard app code and server code, causing `nuxt typecheck` modules to
  lose resolution context.

## Starting a New Project from This Template

Follow these steps **in order** — the init script handles renaming, D1
provisioning, and Doppler setup.

> **Doppler is optional for initial setup.** Steps that require Doppler (project
> creation, hub secret sync, GitHub CI token, analytics) are skipped gracefully
> when the Doppler CLI is not installed or configured. You can complete them
> later by running `doppler setup` and re-running `pnpm run setup` with
> `--repair`. Note: If you do have Doppler installed but your hub secrets are
> not fully configured yet, the setup script will intelligently **defer** the
> analytics provisioning step with a clear follow-up command.

1. Clone:
   `git clone https://github.com/narduk-enterprises/narduk-nuxt-template.git my-app && cd my-app`
2. Clear the template's git history and set up your own repository (Required for
   GitHub CI secrets to bind properly):
   ```bash
   rm -rf .git
   git init
   git remote add origin git@github.com:your-username/my-app.git
   ```
3. Install dependencies: `pnpm install`
4. **Run the initialization script** (renames everything, provisions D1, creates
   Doppler project, pushes CI token to GitHub):
   ```bash
   pnpm run setup -- --name="your-app-name" --display="Your Display Name" --url="https://yoururl.com"
   ```
5. **Configure Local D1 (Critical Step):** If your app uses the database, you
   MUST add `nitro-cloudflare-dev` to your app to proxy D1 to the dev server:
   - `pnpm --filter your-app-name add -D nitro-cloudflare-dev`
   - In your app's `nuxt.config.ts`, add:
     ```ts
     modules: ['nitro-cloudflare-dev'],
     nitro: { cloudflareDev: { configPath: resolve(__dirname, 'wrangler.json') } }
     ```
6. Wire up Doppler locally: `doppler setup --project your-app-name --config dev`
7. Start dev: `doppler run -- pnpm run dev`
8. Verify infrastructure: `pnpm run validate`

> **🛡️ Bootstrap Guard:** `pnpm dev`, `pnpm build`, and `pnpm deploy` are
> **blocked** until `pnpm run setup` has been completed. The setup script writes
> a `.setup-complete` sentinel file; the `pre*` hooks in `package.json` check
> for it. If you see a "PROJECT SETUP NOT COMPLETE" error, follow steps 1–4
> above.

> **❌ GitHub Actions CI Preflight Failures:** The `ci.yml` deploy job requires
> a `DOPPLER_TOKEN` (recommended) or `CLOUDFLARE_API_TOKEN` /
> `CLOUDFLARE_ACCOUNT_ID` in your GitHub repository secrets. If they are
> missing, the deploy will fail at the "preflight" step. The `pnpm run setup`
> script tries to create the `DOPPLER_TOKEN` in GitHub automatically (Step 6),
> but it **will skip this step if you have not set up your git remote** (Step
> 2). **Fix:** Check your GitHub repository secrets. If `DOPPLER_TOKEN` is
> missing, ensure your git remote is set up (`git remote add origin ...`), then
> run
> `pnpm run setup -- --name="your-app-name" --display="Your Display Name" --url="https://yoururl.com" --repair`
> to inject the secret.

## 🚨 CRITICAL RULE: NEVER COMMIT TO THIS REPOSITORY 🚨

If you are an agent building a new project inside a clone of this repository,
**DO NOT COMMIT OR PUSH** directly back to
`narduk-enterprises/narduk-nuxt-template`. Verify the user has set up a new
remote origin first.

## 🚨 ZERO ERRORS & WARNINGS POLICY 🚨

Any project derived from this template, and any code you write, MUST have **zero
errors and zero warnings** (TypeScript, ESLint, Vue, Nuxt, and Build). If you
encounter any pre-existing errors or warnings from the template during
bootstrapping, you must **fix them properly**. Do not use hacky monkey fixes,
`@ts-expect-error`, `eslint-disable`, or other suppression techniques to hide
problems. Find the architectural root cause and solve it correctly.

## Quality Audit Workflows

Run these during development (Antigravity slash-commands). Each corresponds to a
file in `.agents/workflows/`:

| Workflow                      | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `/audit-repo-hygiene`         | Full sweep for secrets, junk files, duplicated code            |
| `/audit-template-compliance`  | Comprehensive Nuxt 4 + Nuxt UI 4 layer template audit          |
| `/check-architecture`         | Thin Components, Thick Composables, Thin Stores separation     |
| `/check-data-fetching`        | Catches waterfalls, raw $fetch, and N+1 queries                |
| `/check-layer-health`         | Layer inheritance, shadowed files, config drift, overrides     |
| `/check-plugin-lifecycle`     | Plugin naming, lifecycle safety, and analytics patterns        |
| `/check-seo-compliance`       | Audits pages for useSeo, Schema.org, and OG images             |
| `/check-ssr-hydration-safety` | SSR safety, window access, isHydrated, ClientOnly, DOM nesting |
| `/check-ui-styling`           | Tailwind v4 CSS import order, token usage, Nuxt UI v4          |
| `/migrate-to-monorepo`        | Migration workflow to convert legacy apps to this monorepo     |
| `/review-cloudflare-layer`    | Full review of Nuxt layer + Cloudflare Workers setup           |
| `/review-doppler-pattern`     | Audit Doppler secret management for completeness and security  |
| `/score-repo`                 | Full repo audit — scores 19 categories out of 10               |

## ESLint Plugins (Automated Enforcement)

These workspace-local ESLint plugins enforce patterns at lint time. Many checks
from `.agents/workflows` (SEO, data-fetching, SSR/hydration, plugin lifecycle,
UI styling, architecture) are now enforced by these plugins so issues are caught
at edit time. Run `pnpm run build:plugins` after cloning to build the TypeScript
plugins.

| Plugin                                      | Rules | What It Enforces                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint-plugin-nuxt-ui`                     | 8     | Nuxt UI v4 props, slots, events, variants, deprecated components (UDivider→USeparator), deprecated API usage                                                                                                                                                                                                                    |
| `eslint-plugin-nuxt-guardrails`             | 16    | SSR DOM access, legacy head/fetch, no raw `$fetch`, `import.meta.client`/`import.meta.dev`, `useAsyncData`/`useFetch`; **SEO:** require useSeo/Schema on pages, prefer useSeo over bare useHead; **server:** no `.map(async)` (N+1); **stores:** useAppFetch, no Map/Set state, plugin `.client.ts` for browser APIs            |
| `eslint-plugin-atx`                         | 30    | Design system: UButton/ULink, no inline hex, Lucide icons, no Tailwind v3 deprecated (fixable), no invalid Nuxt UI tokens, Zod validation; **hydration:** ClientOnly for USwitch/UNavigationMenu/UColorMode\*; no @apply in scoped style; **architecture:** no module-scope ref in composables/utils, no inline types in stores |
| `eslint-plugin-vue-official-best-practices` | 13    | Composition API, Pinia patterns, typed defineProps, `use` prefix                                                                                                                                                                                                                                                                |

**Build:** `pnpm run build:plugins` (ATX plugin is plain `.mjs` — no build
needed).

## Build Pipeline

The monorepo uses **Turborepo** for task orchestration. Key dependency chains:

```
quality ← lint + typecheck
lint    ← build:plugins (ESLint plugins must be compiled first)
build   ← ^build (each app builds after its dependencies)
deploy  ← build (production bundle required)
```

Common commands: `pnpm run quality` (lint + typecheck all packages),
`pnpm run dev` (start `apps/web/`), `pnpm run dev:showcase` (start all example
apps concurrently).

## Layer Inventory (Do Not Duplicate)

Before creating a new file in `apps/web/`, check this list — the layer already
provides these:

| Category                | Provided by Layer                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| **Composables**         | `useSeo`, `useSchemaOrg` (includes `useWebPageSchema`, `useArticleSchema`, `useProductSchema`)    |
| **Plugins**             | `gtag.client.ts`, `posthog.client.ts`, `fetch.client.ts` (CSRF header injection)                  |
| **Server Middleware**   | `cors.ts`, `csrf.ts`, `d1.ts` (database binding), `indexnow.ts`, `securityHeaders.ts`             |
| **Server Utils**        | `database.ts`, `rateLimit.ts`, `auth.ts` (includes `requireAdmin`), `kv.ts`, `r2.ts`, `google.ts` |
| **Server API Routes**   | `/api/health`, `/api/indexnow/submit`, `/api/admin/ga/overview`, `/api/admin/gsc/performance`     |
| **Database Schema**     | Base schema in `server/database/schema.ts` (apps extend via re-export)                            |
| **CSS / Design Tokens** | `main.css` with `@theme` tokens, utility classes (`.glass`, `.card-base`, etc.)                   |
| **Server Routes**       | `cdn-cgi/image/[...path]` (Cloudflare image transforms)                                           |

---

# 📖 Recipes

These are opt-in feature recipes. Follow them when the project needs a specific
capability. For working reference implementations, refer to the showcase apps:
`apps/example-auth/`, `apps/example-blog/`, `apps/example-marketing/`.

---

## 🚀 Initialization Routine (New Projects)

**When:** You have just cloned this template to begin a new application.
**CRITICAL:** This must be your very first step before writing any code.

> **Doppler-optional:** Running setup without Doppler is supported. Steps that
> require Doppler (project creation, hub secret sync, GitHub CI token,
> analytics) are skipped with a clear message. After configuring Doppler, re-run
> with `--repair` to complete those steps.

**Steps:**

1. Run the setup script from the root directory:
   ```bash
   pnpm run setup -- --name="your-app-name" --display="Your Display Name" --url="https://yoururl.com"
   ```
   _(This will rename the project, create the Cloudflare D1 database, spin up
   the Doppler project if available, and rewrite `wrangler.json`.)_
2. Configure your Doppler secrets (see Secrets & Env below).
3. Pull Doppler secrets and initialize the local database schema
   (non-interactive):
   ```bash
   doppler setup --project <app-name> --config dev && pnpm run db:migrate
   ```
4. If setup was run without Doppler, complete the Doppler steps:
   ```bash
   pnpm run setup -- --name="your-app-name" --display="Your Display Name" --url="https://yoururl.com" --repair
   ```
5. Commit the initialization.

---

## 🚀 Recipe: Deploying & D1 Migrations

**When:** You are ready to deploy your application to Cloudflare Workers and
need to manage your D1 database schema.

**Local vs. Remote D1:**

- **Local Dev:** Handled via `pnpm run db:migrate`. This applies schema changes
  to the local `.wrangler/` SQLite file used during `pnpm dev`.
- **Production (Remote):** Must be migrated against the actual Cloudflare D1
  database.

**How Remote Migrations Work in this Template:** The template's GitHub Actions
CI workflow (`.github/workflows/ci.yml`) is configured to **automatically run
remote D1 migrations** during the deploy job. It does this by reading your app's
`db:migrate` script and replacing the `--local` flag with `--remote` right
before running `wrangler deploy`.

- If your app has a `"db:migrate": "wrangler d1 execute ..."` script in its
  `package.json`, CI runs it for you safely.
- **Smoke Tests:** The CI workflow also runs an automated "smoke test" after
  deploying the main web app. It dynamically fetches your newly deployed URL and
  makes a `curl` request to the `/api/users` endpoint to verify the D1 database
  bindings and migrations were successful. If the request fails (e.g., 500 error
  due to missing tables), the CI step fails.

**Manual Remote Migrations (Optional):** If you ever need to apply migrations
manually outside of CI, you can run:

```bash
cd apps/web && pnpm exec wrangler d1 execute <DB_NAME> --remote --file=drizzle/0000_initial_schema.sql
```

_(Replace `<DB_NAME>` with your database name from `wrangler.json`, and repeat
for each `.sql` file in order)._

---

## 🧹 Recipe: Production Cleanup (Delete Examples)

**When:** You are building a real application, not exploring the template. Run
this after the Initialization Routine.

**Steps:**

1. **Delete example apps:**

   ```bash
   rm -rf apps/showcase apps/example-auth apps/example-blog apps/example-marketing apps/example-og-image apps/example-apple-maps
   ```

2. **Remove example scripts from root `package.json`:**
   - `dev:showcase`, `dev:auth`, `dev:blog`, `dev:marketing`, `dev:og-image`,
     `dev:apple-maps`
   - `db:ready:auth`, `db:migrate:auth`, `db:seed:auth`
   - `build:showcase`, `deploy:showcase`
   - `test:e2e:auth`, `test:e2e:blog`, `test:e2e:marketing`,
     `test:e2e:showcase`, `test:e2e:apple-maps`

3. **Remove template-only GitHub Actions workflows:**
   - Delete `.github/workflows/deploy-showcase.yml` (showcase deployment)
   - Delete `.github/workflows/publish-layer.yml` (layer publishing — only
     needed by the template repo itself)
   - Keep `ci.yml`, `deploy.yml`, and `version-bump.yml`

4. **Update `playwright.config.ts`** at the repo root — remove example app
   projects, keep only `apps/web/` if you add E2E tests.

5. **Update `apps/web/nuxt.config.ts`** metadata:
   - `site.name` — change to your app's name
   - `site.description` — change to your app's description
   - `schemaOrg.identity.name` — match your app name
     > _Note: If you ran `pnpm run setup` with `--display`, these values were
     > already replaced automatically._

6. **Replace `apps/web/app/pages/index.vue`** — this is a placeholder landing
   page. Build your actual homepage.

---

## 🔑 Recipe: Secrets & Environment (Doppler)

**When:** Always. This is the standard for all projects.

**Principle:** Doppler is the single source of truth for all secrets and
environment variables. **Never** create `.env` or `.env.example` files. Never
commit secrets. Never commit `doppler.yaml` (it is git-ignored).

**Steps:**

1. Create a Doppler project: `doppler projects create <app-name>`
2. Wire Doppler into your dev workflow (generates `doppler.yaml`):
   ```bash
   doppler setup --project <app-name> --config dev
   doppler run -- pnpm run dev  # Injects env vars at runtime
   ```
3. In `nuxt.config.ts`, declare all secrets in `runtimeConfig` with explicit
   `process.env.KEY` access:
   ```ts
   runtimeConfig: {
     secretKey: process.env.SECRET_KEY || '',        // Server-only
     public: {
       appUrl: process.env.SITE_URL || '',           // Client-safe
     },
   }
   ```
4. **Important:** Doppler env var names are the **raw key names** (e.g.
   `POSTHOG_PUBLIC_KEY`, `SITE_URL`). They do **NOT** use the `NUXT_` prefix.
   The `nuxt.config.ts` reads them directly via `process.env.KEY` at build time.

### Enterprise Hub-and-Spoke Architecture

All template derivatives use **Doppler Cross-Project Secret Referencing** to
avoid duplicating sensitive keys. **Never** copy/paste secret values between
projects manually.

#### Hub Projects (shared infrastructure — you do NOT create these)

| Hub Project            | Purpose                          | Secrets It Owns                                                                                                                     |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `narduk-nuxt-template` | Cloud infrastructure credentials | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`                                                                                     |
| `narduk-analytics`     | Centralized analytics management | `POSTHOG_PUBLIC_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY`, `GA_ACCOUNT_ID`, `GSC_SERVICE_ACCOUNT_JSON` |

#### App Spoke Projects (one per app — created by `init.ts`)

Each app gets its own Doppler project (e.g. `my-cool-app`). The spoke inherits
credentials from hubs using **cross-project references**, plus stores its own
per-app secrets.

**Doppler cross-project reference syntax:**

```
${<hub-project>.<config>.<KEY>}
```

**Example:** To reference the Cloudflare API token from the enterprise hub:

```bash
doppler secrets set CLOUDFLARE_API_TOKEN='${narduk-nuxt-template.prd.CLOUDFLARE_API_TOKEN}' --project my-app --config prd
```

#### Complete Secret Reference Table

| Secret                  | Source                                           | Config | Notes                                           |
| ----------------------- | ------------------------------------------------ | ------ | ----------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `← narduk-nuxt-template` hub ref                 | `prd`  | Deploy credential                               |
| `CLOUDFLARE_ACCOUNT_ID` | `← narduk-nuxt-template` hub ref                 | `prd`  | Deploy credential                               |
| `POSTHOG_PUBLIC_KEY`    | `← narduk-analytics` hub ref                     | `prd`  | Shared across all apps (single PostHog project) |
| `POSTHOG_PROJECT_ID`    | `← narduk-analytics` hub ref                     | `prd`  | Shared across all apps                          |
| `POSTHOG_HOST`          | `← narduk-analytics` hub ref                     | `prd`  | Defaults to `https://us.i.posthog.com`          |
| `APP_NAME`              | Per-app (set by `init.ts`)                       | `prd`  | Differentiates apps in PostHog events           |
| `SITE_URL`              | Per-app                                          | `prd`  | e.g. `https://myapp.com`                        |
| `GA_MEASUREMENT_ID`     | Per-app (auto-generated by `setup-analytics.ts`) | `prd`  | `G-XXXXXXX`                                     |
| `INDEXNOW_KEY`          | Per-app (auto-generated by `setup-analytics.ts`) | `prd`  | 32-char hex                                     |
| `GA_PROPERTY_ID`        | Per-app (auto-generated)                         | `prd`  | GA4 property identifier                         |
| `APPLE_MAPKIT_TOKEN`    | Per-app                                          | `prd`  | MapKit JS JWT token (runtime, client-safe)      |
| `GSC_USER_EMAIL`        | Per-app                                          | `prd`  | Google account email for GSC access             |

#### Dev vs. Prd Configs

- **`dev` config:** Select this when running `doppler setup` locally. Hub
  references resolve automatically. You can override any key for local testing
  without affecting production.
- **`prd` config:** Used by CI/CD (`deploy.yml`). The `init.ts` script
  provisions hub references in `prd` only. The `DOPPLER_TOKEN` GitHub secret is
  scoped to `prd`. **CRITICAL:** Deployments will fail with "Cloudflare
  credentials missing" if your `prd` config does not contain
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (either directly or via hub
  reference).
- **`stg` config:** Available if needed; not provisioned by default.

#### CI/CD Flow

**Deploy will fail until:**

1. GitHub must have either the `DOPPLER_TOKEN` secret (recommended) or both
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
2. If setup was run without a git remote, add the remote and re-run with
   `--repair` to set `DOPPLER_TOKEN`.
3. The app's Doppler `prd` config must expose `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` (via hub sync or direct) so the deploy job can run
   `wrangler deploy`.

4. `init.ts` creates a Doppler service token (`ci-deploy`) scoped to
   `<app-name>/prd`
5. The token is stored as `DOPPLER_TOKEN` GitHub Actions secret
6. On push to `main`, `deploy.yml` uses the `dopplerhq/secrets-fetch-action` to
   securely fetch **all resolved secrets** (hub refs are resolved server-side)
   and inject them into `$GITHUB_ENV`
7. `pnpm build` and `wrangler deploy` run with full access to all secrets

**Reference:** See `apps/example-auth/nuxt.config.ts` for the full runtimeConfig
block.

---

## 🧪 Recipe: Testing (Vitest + Playwright)

**When:** You need unit tests for composables or E2E tests for user flows.

**Steps:**

1. Install dependencies:

   ```bash
   pnpm install -D vitest @nuxt/test-utils happy-dom playwright @playwright/test
   npx playwright install chromium
   ```

2. Create `vitest.config.ts`:

   ```ts
   import { defineVitestConfig } from '@nuxt/test-utils/config'
   export default defineVitestConfig({})
   ```

3. Create `playwright.config.ts`:

   ```ts
   import { defineConfig, devices } from '@playwright/test'
   export default defineConfig({
     testDir: './tests/e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     reporter: 'html',
     use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
     webServer: {
       command: 'npx nuxi dev --port 3000',
       url: 'http://localhost:3000',
       reuseExistingServer: !process.env.CI,
       timeout: 120_000,
     },
     projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
   })
   ```

4. Add npm scripts to `package.json`:

   ```json
   "test:unit": "vitest run",
   "test:e2e": "playwright test"
   ```

5. Place unit tests in `tests/composables/`, E2E tests in `tests/e2e/`.

**Reference:** Tests can be added to any example app under `tests/composables/`
and `tests/e2e/`.

### Test Explorer: enabling Playwright projects

E2E tests use a **single root config** (`playwright.config.ts` at repo root)
with one project per app (showcase, example-auth, example-blog,
example-marketing). In the IDE Test Explorer, those projects can appear as
**disabled** (greyed out) until you enable them: open the **Playwright** sidebar
(below the Test Explorer), find **PROJECTS**, and **check the boxes** for the
apps you want. After that you can run or debug tests from the Test Explorer as
usual. From the terminal, `pnpm test:e2e` runs all projects;
`pnpm test:e2e:auth` runs only the example-auth project.

### 🤖 Agent Testing Instructions

When writing new features, modifying components, or creating composables,
**agents MUST write a reasonable amount of tests against their code**.

- **Unit Tests:** Core business logic, parsers, formatters, and composables
  should have dedicated unit tests (`tests/composables/`, `tests/utils/`) using
  Vitest.
- **E2E Tests:** Critical user flows (e.g., login, onboarding, checkout) must
  have E2E tests using Playwright.
- **Environment Agnostic:** Ensure tests are designed so they can be run **both
  against local dev servers and against live production deployments** (e.g.,
  using parameterized base URLs and robust locators).

---

## 🔒 Recipe: Authentication (Web Crypto + D1 Sessions) `[OPT-IN — FULL SETUP]`

**When:** Your app needs user accounts, login, and protected routes.

**Steps:**

1. Add auth tables to `server/database/schema.ts` (users + sessions tables with
   Drizzle).
2. Create `server/utils/auth.ts` — PBKDF2 password hashing using `crypto.subtle`
   (NOT bcrypt).
3. Create API routes: `server/api/auth/login.post.ts`, `register.post.ts`,
   `logout.post.ts`, `me.get.ts`.
4. Create `app/composables/useAuth.ts` — reactive auth state backed by
   `useState()`.
5. Create `app/middleware/auth.ts` — route guard that redirects unauthenticated
   users.

### 🚨 Extending the Database Schema

The layer provides base `users` and `sessions` tables via its own
`server/database/schema.ts` and auto-imports its own `useDatabase` helper. If
your app defines its own schema (e.g., adding `clients` and `invoices` tables,
or modifying the base tables), you **must** provide your own database helper in
your app (e.g., `apps/web/server/utils/database.ts` -> `useAppDatabase(event)`).

**To extend the schema:**

1. Re-export the layer schema in your app
   (`export * from '#layer/server/database/schema'`).
2. Define your new tables below the re-export.
3. Create `apps/web/server/utils/database.ts` that exports
   `useAppDatabase(event)` containing your new schema.
4. Call `useAppDatabase(event)` from all your app's server routes.

Using the auto-imported `useDatabase` from the layer will resolve to the layer's
schema, causing your app's tables to be missing from the Drizzle instance. **If
you name your app util `useDatabase`, Nitro will warn about "Duplicated imports"
and favor the layer's version.**

**Key constraint:** All crypto MUST use Web Crypto API
(`crypto.subtle.deriveKey` with PBKDF2). Node.js `crypto` and `bcrypt` are
forbidden on Cloudflare Workers.

**Reference:** See `apps/example-auth/server/utils/` and
`apps/example-auth/app/composables/useAuth.ts`.

---

## 📊 Recipe: Analytics (PostHog + GA4 + GSC + IndexNow + Indexing API)

**When:** You need product analytics, web analytics, and search engine
integration.

**Steps:**

1. **PostHog:** Already wired.
2. **GA4:** Already wired.
3. **IndexNow:** Already wired (Covers Bing, Yandex, Seznam, Naver).
4. **Google Search Console:** Use the setup automation in the examples app.
5. **Google Indexing API:** Already wired (Requires GSC_SERVICE_ACCOUNT_JSON and
   the Web Search Indexing API enabled in GCP).

All plugins **no-op gracefully** when their keys are empty — safe for dev
without any Doppler config.

**Automated setup:** The examples app includes `tools/setup-analytics.ts` which
bootstraps GA4 and GSC via API. Use `tools/gsc-toolbox.ts` to manually submit or
check status for the Indexing API (`index-url`, `remove-url`, `index-status`).

**Doppler architecture:** Universal management keys live in the
`narduk-analytics` Doppler project. Per-app keys go in the app's own Doppler
project. You must reference the exact `POSTHOG_PUBLIC_KEY` and
`POSTHOG_PROJECT_ID` from the analytics hub.

> **⚠️ WARNING: PostHog Workspaces** Do not create a separate project workspace
> inside PostHog for each new app unless specifically requested! The expected
> behavior is that ALL template apps log to the single "Narduk Analytics" master
> project in PostHog. The apps are differentiated using the `app:` property
> attached to every event by the client plugin. Ensure your Doppler environment
> references the `narduk-analytics` keys directly.

---

## 📝 Recipe: Content & Blog (Nuxt Content v3) `[OPT-IN — FULL SETUP]`

**When:** Your app needs a blog, documentation, or markdown-based content.

**Steps:**

1. `@nuxt/content` is already in the template. Create markdown files in
   `content/`.
2. Create a blog layout: `app/layouts/blog.vue` with sidebar + header chrome.
3. Create blog pages: `app/pages/blog/index.vue` (list) and
   `app/pages/blog/[slug].vue` (detail).
4. Query content with `queryCollection('content')` in `useAsyncData`.
5. Render with `<ContentRenderer :value="post" />`.

**Key gotcha:** On Cloudflare Workers, Nuxt Content auto-switches to D1 database
storage. Make sure the `DB` binding is configured in `wrangler.json`.

**Reference:** See `apps/example-blog/content/blog/` and
`apps/example-blog/app/pages/`.

---

## 🎯 Recipe: Linting & Code Quality `[INCLUDED]`

**When:** Setting up ESLint for a new project.

**Steps:**

1. Install: `pnpm install -D @nuxt/eslint eslint`
2. Add to `nuxt.config.ts` modules: `'@nuxt/eslint'`
3. Create `eslint.config.mjs`:
   ```js
   import withNuxt from './.nuxt/eslint.config.mjs'
   export default withNuxt()
   ```
4. Add script: `"lint": "eslint ."` / `"lint:fix": "eslint . --fix"`

**Runtime audits:** Use the built-in `/check-*` workflows (see Quality Audit
Workflows above) to validate Nuxt UI v4 compliance, SSR safety, store
separation, and edge compatibility.

---

## 🎨 Recipe: UI Components (Landing Pages, Dashboards) `[INCLUDED — COPY FROM EXAMPLES]`

**When:** You need pre-built UI sections like heroes, pricing tables,
testimonials, contact forms, or dashboard layouts.

**Steps:**

1. Browse components in `apps/example-marketing/app/components/ui/` —
   `HeroSection`, `PricingTable`, `TestimonialCarousel`, `ContactForm`.
2. Browse layouts: `apps/example-blog/app/layouts/blog.vue`,
   `apps/example-auth/app/layouts/dashboard.vue`,
   `apps/example-marketing/app/layouts/landing.vue`.
3. Copy what you need into your project's `app/components/` or `app/layouts/`.
4. Customize colors via `app/app.config.ts` and fonts via
   `app/assets/css/main.css`.

**Reference:** See the showcase apps for working examples of each component.

---

## 🛠️ Recipe: Form Handling `[INCLUDED]`

**When:** You need validated forms with Zod and consistent styling.

**Steps:**

1. Use Nuxt UI's native `<UForm :schema :state>` with Zod validation.
2. Connect fields via `<UFormField name="...">`.
3. For consistent card chrome, create an `AppFormCard` wrapper component.
4. Use layout utility classes in `main.css`: `.form-section` (vertical gap),
   `.form-row` (2-col grid), `.form-actions` (button alignment).

**Reference:** See `apps/example-auth/app/pages/login.vue` and
`apps/example-marketing/app/components/ui/ContactForm.vue` for Zod-validated
form examples.
