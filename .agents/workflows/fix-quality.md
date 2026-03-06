---
description:
  Systematically fix all pnpm quality issues (ESLint errors/warnings +
  TypeScript type errors) to achieve zero failures
---

# Fix PNPM Quality Issues

This workflow systematically resolves all `pnpm run quality` failures in the
monorepo. The quality gate runs **lint** (ESLint `--max-warnings 0`) and
**typecheck** (`nuxt typecheck`) across all apps via Turborepo.

Do not ask the user questions. Fix issues autonomously.

## Constraints

- **Zero suppression**: No `@ts-expect-error`, `@ts-ignore`, `eslint-disable`,
  `any` casts, or other suppression hacks. Root-cause every issue.
- **Minimal diffs**: Fix the issue, nothing else. No refactors, no cosmetic
  changes.
- **Preserve behavior**: Fixes must not change runtime semantics or visuals.
- **Monorepo-aware**: Issues may originate in `apps/web/`,
  `layers/narduk-nuxt-layer/`, or `packages/eslint-config/`.

---

## Step 1: Build ESLint Plugins

The workspace ESLint plugins must be compiled before linting can run. This is
the most common cause of "quality won't even start" failures.

// turbo

```bash
pnpm run build:plugins
```

If this fails, fix the TypeScript errors inside `packages/eslint-config/` first,
then re-run.

---

## Step 2: Run Quality Gate — Capture Baseline

// turbo

```bash
pnpm run quality 2>&1 | head -300
```

Record the total error and warning counts. If quality passes cleanly (exit 0),
stop — there is nothing to fix.

---

## Step 3: Isolate Failures by Type

If Step 2 failed, determine which sub-task failed:

- **Lint failure** → ESLint errors or warnings remain. Run lint in isolation: //
  turbo

  ```bash
  pnpm run lint 2>&1 | head -300
  ```

- **Typecheck failure** → TypeScript errors remain. Run typecheck in isolation:
  // turbo
  ```bash
  pnpm run typecheck 2>&1 | head -300
  ```

If both failed, fix **typecheck first** (structural issues often cause
downstream lint noise).

---

## Step 4: Fix TypeScript Errors

Attack in this order:

1. **Missing imports / unresolved modules** — usually a missing `#server/` alias
   or wrong import path.
2. **Type mismatches** — wrong prop types, missing return types, incompatible
   assignments.
3. **Drizzle / D1 schema errors** — ensure `server/database/schema.ts`
   re-exports the layer schema.
4. **Vue template type errors** — complex template expressions should move to
   `computed()`.

After each batch of fixes, verify progress:

// turbo

```bash
pnpm run typecheck 2>&1 | head -200
```

Repeat until typecheck passes.

---

## Step 5: Fix ESLint Errors and Warnings

### 5A: Auto-fix what ESLint can handle

// turbo

```bash
cd apps/web && pnpm run lint -- --fix 2>&1 | head -200
```

### 5B: Fix remaining manual issues

Common institutional patterns:

| Rule / Pattern                      | Fix                                                            |
| ----------------------------------- | -------------------------------------------------------------- |
| `unicorn/prefer-at`                 | Use `.at(-1)` instead of `[arr.length - 1]`                    |
| `unicorn/prefer-string-replace-all` | Use `.replaceAll()` instead of `.replace(/pattern/g, ...)`     |
| `@typescript-eslint/no-unused-vars` | Remove the variable or prefix with `_`                         |
| `nuxt-guardrails/no-raw-fetch`      | Use `useAsyncData`/`useFetch` instead of raw `$fetch` in setup |
| `nuxt-guardrails/require-use-seo`   | Add `useSeo()` call to the page                                |
| `vue/no-complex-expression`         | Move expression to a `computed()`                              |
| `atx/no-module-scope-ref`           | Move bare `ref()` inside a composable function body            |
| `import-x/order`                    | Reorder imports (usually auto-fixable)                         |

After each batch, verify progress:

// turbo

```bash
cd apps/web && pnpm run lint 2>&1 | head -200
```

Repeat until lint passes with zero warnings.

---

## Step 6: Final Verification

Run the full quality gate from the repo root to confirm everything is green:

// turbo

```bash
pnpm run quality
```

This must exit 0. If it does not, return to Step 3 and iterate.

---

## Step 7: Commit

```bash
git add -A && git commit -m "chore: resolve all quality errors and warnings"
```

Report the final results to the user: how many errors/warnings were fixed, which
files were changed, and confirmation that `pnpm run quality` passes cleanly.
