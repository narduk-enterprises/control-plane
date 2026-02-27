# Nuxt 4 Template Examples (Monorepo App)

> **⚠️ ARCHITECTURE NOTICE:** This project is part of a PNPM Workspace. 
> It extends the core business logic and UI components from `../../layers/narduk-nuxt-layer`.

This application contains full-featured reference implementations built on top of the shared Nuxt Layer:
- 🔒 Authentication (Web Crypto PBKDF2 + D1 sessions)
- 📊 Analytics (PostHog + GA4 + GSC + IndexNow setup automation)
- 📝 Blog (Nuxt Content v3 with MDC rendering)
- 🎨 UI Components (Hero, Pricing, Testimonials, Contact Forms)
- 🏗️ Layouts (Blog, Dashboard with sidebar)
- 🧪 Tests (Vitest unit + Playwright E2E)

### Development

To run this application locally:

```bash
# From the workspace root:
pnpm --filter examples dev

# Or directly from this directory:
pnpm run dev
```

### Documentation

Please refer to the [Workspace Root README](../../README.md) and [Global Agent Instructions](../../AGENTS.md) for full architectural constraints, database setup instructions, and Cloudflare Worker requirements.
