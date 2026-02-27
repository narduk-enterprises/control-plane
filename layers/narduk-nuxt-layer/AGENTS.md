# AGENTS.md — AI Agent Instructions

> **🚨 CRITICAL: THIS IS A NUXT LAYER 🚨**
>
> You are working inside **`loganrenz/narduk-nuxt-layer`**. This is NOT an application that gets deployed to production directly.
> This is a shared library/layer that downstream applications (like `nuxt-v4-template` or `circuit-breaker-online`) extend using `extends: ['github:loganrenz/narduk-nuxt-layer#main']`.
>
> **When to edit files here:**
>
> - When you are creating a generic, reusable component that should be available to ALL Narduk applications.
> - When you are updating core ESLint toolings, base Nitro API endpoints, or database schema primitives.
>
> **When NOT to edit files here:**
>
> - If you are building a feature specific to one app, you must make that change in the downstream app, NOT here.

This layer provides a **minimal Nuxt 4 + Nuxt UI 4** foundation deployed to **Cloudflare Workers** with **D1 SQLite** (Drizzle ORM).

## Project Structure

```
app/                  # All frontend code (Nuxt 4 convention)
  components/         # Vue components (thin — delegate logic to composables)
    OgImage/          # Dynamic OG image templates (Satori)
  composables/        # Business logic + SEO helpers (useSeo, useSchemaOrg)
  pages/              # File-based routing
  layouts/            # Page layouts (default: landing)
  middleware/         # Route guards (empty — add as needed)
  plugins/            # Client plugins (PostHog, GA4, CSRF fetch interceptor)
  types/              # Shared TypeScript interfaces
  assets/css/main.css # Tailwind CSS 4 @theme tokens
  app.config.ts       # Nuxt UI color tokens (primary/neutral)
server/
  api/                # Nitro endpoints (health check, IndexNow)
  database/           # Drizzle schema definitions
  middleware/         # CSRF protection, D1 injection
  routes/             # Dynamic routes (IndexNow key verification)
  utils/              # Cloudflare bindings (database, KV, R2, rate limiting)
drizzle/              # SQL migration files
scripts/              # Utility scripts (favicon generation)
.agents/workflows/    # Antigravity audit workflows (run via /slash-commands)
```

## Hard Constraints (Cloudflare Workers)

- **NO Node.js modules** — no `fs`, `path`, `crypto`, `bcrypt`, `child_process`
- **Use Web Crypto API** — `crypto.subtle` for all hashing (PBKDF2)
- **Nitro preset** is `cloudflare-module` (ES Module format, V8 isolates)
- **Drizzle ORM only** — no Prisma or other Node-dependent ORMs
- All server code must be stateless across requests (edge isolate model)

## Nuxt UI 4 Rules

- `UDivider` → renamed to **`USeparator`** in v4
- Icons use `i-` prefix: `i-lucide-home`, not `name="heroicons-..."`
- Use design token colors (`primary`, `neutral`) not arbitrary color strings
- Tailwind CSS 4 — configure via `@theme` in `main.css`, not `tailwind.config`

## SEO (Required on Every Page)

Every page **must** call both:

```ts
useSeo({
  title: '...',
  description: '...',
  ogImage: { title: '...', description: '...', icon: '🎯' },
});
useWebPageSchema({ name: '...', description: '...' }); // or useArticleSchema, useProductSchema, etc.
```

Sitemap and robots.txt are automatic. OG image templates live in `app/components/OgImage/`.

## Architecture Patterns

- **Thin Components, Thick Composables** — components subscribe to composables, pass props down, emit events up. No inline fetch or complex logic in templates.
- **SSR-safe state** — use `useState()` or Pinia stores. Never use bare `ref()` at module scope (causes cross-request leaks).
- **Data fetching** — always use `useAsyncData` or `useFetch`, never raw `$fetch` in `<script setup>`.
- **Client-only code** — wrap `window`/`document` access in `onMounted` or `<ClientOnly>`.

## Integrating this Layer into a New Project

If you are an agent tasked with adding this layer to a new or existing Nuxt application, run the `/migrate-to-layer` workflow.

Do **NOT** clone `narduk-nuxt-layer` directly to start a project. Start with `nuxt-v4-template` instead.

## Quality Audit Workflows

Run these during development (Antigravity slash-commands):

| Workflow                  | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `/check-nuxt-ui-v4`       | Validates UI 4 component usage                             |
| `/check-nuxt-ssr`         | Validates SSR-safe data fetching and hydration             |
| `/check-store-separation` | Validates thin component / thick composable pattern        |
| `/check-nitro-edge`       | Validates Cloudflare Workers compatibility                 |
| `/check-seo-compliance`   | Audits pages for useSeo, Schema.org, and OG images         |
| `/check-data-fetching`    | Catches waterfalls, raw $fetch, and N+1 queries            |
| `/check-css-tokens`       | Audits Tailwind v4 import order, tokens, and deprecated    |
| `/check-plugin-lifecycle` | Audits plugin naming, lifecycle safety, and analytics      |
| `/check-types-services`   | Audits Thin Store decomposition (types/services/sizes)     |
| `/check-hydration-safety` | Deep hydration audit (isHydrated, ClientOnly, DOM nesting) |

## ESLint Plugins (Automated Enforcement)

These workspace-local ESLint plugins enforce patterns at lint time. Run `pnpm run build:plugins` after cloning to build the TypeScript plugins.

| Plugin                                      | Rules | What It Enforces                                                                 |
| ------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `eslint-plugin-nuxt-ui`                     | 7     | Nuxt UI v4 props, slots, events, variants, deprecated API usage                  |
| `eslint-plugin-nuxt-guardrails`             | 7     | SSR DOM access, legacy head/fetch, `import.meta.client`, `useAsyncData`          |
| `eslint-plugin-atx`                         | 24    | Design system: prefer UButton/ULink, no inline hex, Lucide icons, Zod validation |
| `eslint-plugin-vue-official-best-practices` | 13    | Composition API, Pinia patterns, typed defineProps, `use` prefix                 |

**Build:** `pnpm run build:plugins` (ATX plugin is plain `.mjs` — no build needed).

---

# 📖 Application Recipes

The opt-in feature recipes (Auth, Analytics, Content, Testing, UI Components, Forms) are application-level concerns.

For full instructions on how to implement them, please refer to the **[Workspace Root AGENTS.md](../../AGENTS.md)**.
