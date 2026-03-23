---
name: mutation-hardening
description:
  Harden server mutations with auth classes, rate limits, and schema validation
---

# mutation-hardening

Use when editing `*.post.ts`, `*.put.ts`, `*.patch.ts`, or `*.delete.ts` routes,
especially in `layers/narduk-nuxt-layer/server/` or `apps/web/server/`.

## Required Pattern

1. Classify the route first: `admin`, `user`, `public`, `webhook`, `cron`, or
   `callback`.
2. Enforce auth and rate limit before any body parsing or business logic.
3. Parse request data through a schema, then operate on validated data only.
4. Keep mutation helpers thin and reusable so routes stay consistent.

## Rules

- Prefer wrapper helpers over raw `defineEventHandler` in mutation routes.
- Never trust raw `readBody()` output.
- Avoid `process.env` and Node-only APIs in worker runtime code.
- If a pattern repeats, move it into the shared layer or ESLint instead of
  copying it.
