<div align="center">
  <h1>✨ Nuxt 4 + Nuxt UI 4 Edge Template ✨</h1>
  <p><strong>A minimal, production-ready thin skeleton designed to inherit from the Narduk Nuxt Layer.</strong></p>
</div>

<br />

Built exclusively for the edge. This template combines the power of **Nuxt 4**, the aesthetics of **Nuxt UI 4 (Tailwind CSS 4)**, and the global low-latency of **Cloudflare Workers** with **D1 SQLite databases**.

> **⚠️ ARCHITECTURE UPDATE:** This repository is now a **PNPM Workspace Monorepo**. The application lives in `apps/web/` and extends the local layer inside `layers/narduk-nuxt-layer/`. This allows you to rapidly iterate on both the app and the shared library simultaneously.

> **Looking for examples?** Check out the companion repo **[`nuxt-v4-template-examples`](https://github.com/loganrenz/nuxt-v4-template-examples)** for full-featured implementations of auth, analytics, blog, dashboard layouts, and more.

---

## 🚀 Features

- ⚡️ **Nuxt 4** — Configured for the future with `compatibilityVersion: 4` and the new `app/` structure.
- 🎨 **Nuxt UI 4** — Gorgeous, accessible UI components with built-in dark mode and Tailwind CSS 4 (`@theme`).
- 🦾 **TypeScript** — Full end-to-end type safety out of the box.
- 🌐 **Cloudflare Workers** — True edge deployment running on V8 isolates (no Node.js cold starts).
- 🗄️ **Cloudflare D1** — Edge SQLite database integrated seamlessly with **Drizzle ORM**.
- 🔍 **Advanced SEO System** — Powered by `@nuxtjs/seo`: auto sitemap, robots.txt, Schema.org structured data, dynamic OG images, and `useSeo()` / `useSchemaOrg()` composables.
- 📊 **Analytics-Ready** — PostHog and GA4 client plugins wired up; just add your keys via Doppler.
- 🛡️ **Hardened Security** — Built-in CSRF protection and per-isolate IP rate limiting.
- 🚦 **Health Checks & Error Handling** — Branded global error pages (404/500) and `/api/health` endpoint.

---

## ⚠️ IMPORTANT: This is a Template Repository

> **DO NOT push changes back to `loganrenz/nuxt-v4-template`.** This repository is a read-only template. Always create your own copy first.

---

## 💻 Quick Start

### 1. Initial Setup

```bash
git clone https://github.com/loganrenz/nuxt-v4-template-monorepo.git my-new-project
cd my-new-project
pnpm install
```

### 2. Local Development

```bash
# Option 1: With Doppler (recommended — injects secrets)
doppler run -- pnpm run dev

# Option 2: Without secrets (analytics will no-op)
pnpm run dev
```

---

## 🔑 Secrets Management (Doppler)

This template uses **Doppler** as the single source of truth for all secrets and environment variables. **No `.env` files.**

```bash
doppler projects create <app-name>
doppler setup
doppler run -- pnpm run dev
```

All `runtimeConfig` keys in `nuxt.config.ts` auto-map from Doppler via the `NUXT_` prefix convention.

---

## ☁️ Deployment (Cloudflare Workers)

### 1. Provision D1 Database

```bash
pnpm wrangler d1 create <app-name>-db
```

Paste the `database_id` into `wrangler.json`.

### 2. Apply Migrations

```bash
pnpm wrangler d1 execute <app-name>-db --remote --file=drizzle/0000_initial_schema.sql
```

### 3. Deploy

```bash
pnpm run deploy
```

---

## 🧩 Project Structure (PNPM Workspace)

This repository functions as a single **PNPM Workspace** managing both the web application and the shared layer.

```text
pnpm-workspace.yaml    # Workspace root config
package.json           # Global scripts (pnpm run dev, pnpm run quality)
AGENTS.md              # Global AI coding guidelines
.agents/               # Saved AI workflows
apps/
  web/                 # The main Nuxt 4 application
    app/               # App UI (pages, components, layouts)
    server/            # Edge API endpoints and D1 database handling
    nuxt.config.ts     # Extends the local layer
    package.json
layers/
  narduk-nuxt-layer/   # The centralized business logic and UI layer
    app/               # Shared components, composables, plugins, types
    server/            # Centralized API logic and database schemas
    nuxt.config.ts
```

---

## 🎨 Design Customization

```ts
// app/app.config.ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'emerald', // blue, violet, rose, amber...
      neutral: 'slate', // zinc, gray, stone...
    },
  },
});
```

---

## 🤖 AI Agent Instructions

See **[AGENTS.md](./AGENTS.md)** for complete agent instructions, including:

- Hard constraints for Cloudflare Workers compatibility
- Nuxt UI 4 rules and gotchas
- **Recipes** — step-by-step guides for adding testing, auth, analytics, content, linting, and UI components
- Quality audit workflows (`/check-nuxt-ui-v4`, `/check-nuxt-ssr`, etc.)

---

## 📖 Examples Application

For full-featured reference implementations, explore the **`apps/examples/`** directory in this workspace:

- 🔒 Authentication (Web Crypto PBKDF2 + D1 sessions)
- 📊 Analytics (PostHog + GA4 + GSC + IndexNow setup automation)
- 📝 Blog (Nuxt Content v3 with MDC rendering)
- 🎨 UI Components (Hero, Pricing, Testimonials, Contact Forms)
- 🏗️ Layouts (Blog, Dashboard with sidebar)
- 🧪 Tests (Vitest unit + Playwright E2E)
