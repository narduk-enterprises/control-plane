---
description: Deep-thinking audit of Nuxt Layer inheritance health — shadowed files, config drift, dependency bloat, and override correctness
---

# Nuxt Layer Health Check

This workflow audits the relationship between downstream apps and the shared Nuxt Layer (`layers/narduk-nuxt-layer`). Unlike deterministic checklists, this workflow requires you to **read, compare, and reason** about every finding before recommending action. Two runs should never produce identical output because the codebase evolves.

## Background: How Nuxt Layers Work

Nuxt layers are merged using [c12](https://github.com/unjs/c12) and [defu](https://github.com/unjs/defu). The following directories are **auto-scanned** from both the layer and the consuming app:

- `app/components/*`, `app/composables/*`, `app/layouts/*`, `app/middleware/*`
- `app/pages/*`, `app/plugins/*`, `app/utils/*`, `app/app.config.ts`
- `server/*` (endpoints, middleware, utils, plugins)
- `nuxt.config.ts`

**Priority order** (highest → lowest): project files > `~~/layers/` (alphabetical, Z > A) > `extends` entries (first > last). This means a downstream file with the same name as a layer file will **silently shadow** the layer version — no warning, no error.

---

## Step 1: Inventory the Layer's Public Surface

Before you can detect problems, you must understand what the layer provides. Explore the layer directory structure and build a mental model:

1. Read the layer's `nuxt.config.ts` — note which modules are registered, which CSS files are included, and any runtime config or module options set.
2. List all files under the layer's `app/` directory (components, composables, plugins, layouts, middleware, utils). These are the "provided" files.
3. List all files under the layer's `server/` directory (API routes, middleware, utils, plugins). These are the "provided" server files.
4. Read the layer's `package.json` — note all dependencies it declares. These should NOT be duplicated in downstream `package.json` files.

**Think:** What is the layer's "contract"? What does it promise to provide so that downstream apps don't have to?

---

## Step 2: Detect File-Level Shadowing

For each downstream app in `apps/`, compare its file tree against the layer's. Look for files that exist in **both** locations:

1. For each auto-scanned directory (`app/components`, `app/composables`, `app/plugins`, `app/layouts`, `app/middleware`, `app/utils`, `server/utils`, `server/middleware`, `server/api`, `server/plugins`), check if the downstream app contains files with the **same name** as the layer.
2. When you find a match, **read both files**. Diff them mentally or with `diff`.
3. Classify each shadow:
   - **Identical copy** → should be deleted from the downstream app (it adds nothing and risks going stale).
   - **Intentional override** → the downstream version extends or replaces the layer's behavior. This is valid but should have a comment like `// Overrides layer default because...`. If there is no comment, ask whether it's intentional.
   - **Accidental divergence** → the downstream copy was once identical but has drifted. Determine which version is authoritative and reconcile.

**Think:** For each shadow, what would happen if the downstream copy were deleted? Would the app break, or would it transparently fall through to the layer version?

---

## Step 3: Detect Config-Level Duplication

Compare each downstream app's `nuxt.config.ts` against the layer's:

1. **Modules array:** If the downstream app re-declares modules that the layer already provides (`@nuxt/ui`, `@nuxt/fonts`, `@nuxt/image`, `@nuxtjs/seo`, `@nuxt/eslint`), flag them. Thanks to defu merging, these redundant entries are usually harmless but are confusing and should be removed.
2. **Module options:** If the downstream app sets options for layer-provided modules (e.g., `ogImage`, `colorMode`, `ui`), determine whether these are **intentional overrides** or accidental duplication. Read both configs and compare.
3. **Runtime config:** Check if the downstream app re-declares `runtimeConfig` keys that the layer also declares. Defu will merge them, but identical keys with different defaults can cause subtle bugs.
4. **Nitro config:** Check for `nitro.rollupConfig`, `nitro.externals`, or `nitro.preset` settings that duplicate or conflict with the layer.
5. **CSS:** Check if the downstream app imports CSS files that the layer already imports (e.g., `main.css`).

**Think:** For each duplicated config entry, what is the merge behavior? Does defu's deep-merge produce the correct result, or does the duplication cause unexpected behavior?

---

## Step 4: Detect Dependency Bloat

Compare each downstream app's `package.json` against the layer's:

1. List all `dependencies` and `devDependencies` in the downstream `package.json`.
2. For each, check if the layer's `package.json` already declares the same package.
3. Flag duplicates. In a PNPM workspace, the layer's dependencies are available to the downstream app via workspace hoisting — re-declaring them wastes space and risks version conflicts.
4. Pay special attention to **version mismatches**: if the downstream app pins `zod@3.22` but the layer provides `zod@3.23`, the workspace resolver may pick one or the other unpredictably.

**Think:** Which downstream dependencies are truly app-specific (e.g., a scraping library, an API client) vs. inherited from the layer?

---

## Step 5: Detect Missing Layer Adoption

Sometimes the opposite problem occurs — the downstream app implements something manually that the layer already provides, but under a different name or structure:

1. Search the downstream app for patterns that the layer standardizes:
   - Manual `useHead()` or `useSeoMeta()` calls instead of the layer's `useSeo()` composable.
   - Manual PostHog/GA initialization instead of the layer's plugins.
   - Manual CSRF token handling instead of the layer's middleware.
   - Manual rate limiting instead of the layer's `rateLimit` utility.
   - Inline Drizzle schema definitions instead of extending the layer's schema.
2. For each finding, determine whether migration to the layer's version is straightforward or would require app-specific customization.

**Think:** Is the downstream app "fighting" the layer by reimplementing things the layer already handles? What would it take to adopt the layer's version?

---

## Step 6: Validate the Layer Itself

Turn the lens on the layer to ensure it is well-structured:

1. **Does the layer have any app-specific code?** Layers should be generic. Flag any hardcoded URLs, project names, or domain-specific logic that doesn't belong in a shared layer.
2. **Are the layer's auto-scanned directories properly structured?** Verify that `app/components`, `app/composables`, etc. follow Nuxt conventions.
3. **Does the layer export types correctly?** Check for a `tsconfig.json` or type augmentations that ensure consuming apps get proper TypeScript support.
4. **Is the layer's `nuxt.config.ts` minimal?** A layer config should declare defaults that consumers can override, not enforce opinions that apps can't escape.

**Think:** If a brand-new app extended this layer with zero customization, would it get a sensible, working baseline? Or would it be forced to override things just to function?

---

## Step 7: Compile Findings

Write a structured report with the following sections. Every finding must include your reasoning — do not just list files.

| Section                | What to Include                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Shadowed Files**     | Each shadow with classification (identical / intentional / diverged) and recommendation |
| **Config Duplication** | Each duplicated config key with merge-behavior analysis                                 |
| **Dependency Bloat**   | Each duplicated dependency with version comparison                                      |
| **Missing Adoption**   | Each manual reimplementation with migration difficulty estimate                         |
| **Layer Quality**      | Any issues found in the layer itself                                                    |

For each finding, assign a severity:

- 🔴 **Breaking** — will cause bugs, silent overwrites, or version conflicts
- 🟠 **Wasteful** — duplication that increases maintenance burden
- 🟡 **Improvement** — opportunity to adopt the layer more fully
- 🟢 **Informational** — worth documenting but no action needed

Present findings to the user before making any changes.
