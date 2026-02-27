---
description: How to migrate an existing app to the new Nuxt Layer architecture (narduk-nuxt-layer)
---

# Migrate to the Nuxt Layer Architecture

The Nuxt 4 Architecture has evolved. The upstream `nuxt-v4-template` is now a **thin skeleton**, and the actual core business logic, components, composables, and tooling have been abstracted into the **`narduk-nuxt-layer`**.

If you are an agent tasked with migrating an existing standalone Nuxt application (like `circuit-breaker-online`) to this new architecture, follow these instructions precisely.

## Phase 1: Update Configuration and Dependencies

1. **Clean your `package.json`.**
   - **Dependencies:** Delete the old core UI dependencies (like `@nuxt/ui`, `@nuxtjs/seo`, `tailwindcss`, `drizzle-orm`, `zod`). The layer provides these. You should drastically simplify the downstream app's `package.json` to only encompass app-specific dependencies (e.g. `cheerio`, `googleapis`).
   - **Scripts:** Delete any legacy scripts dealing with building local plugins (e.g., `build:plugins`, `prelint`, or `postinstall` steps that build tools/plugins). Just rely on the standard Nuxt init/build scripts.
2. **Add the Nuxt layer inheritance.** In `nuxt.config.ts`, add the extends property:
   ```ts
   export default defineNuxtConfig({
     extends: ['github:loganrenz/narduk-nuxt-layer#main'],
     // ...
   });
   ```
3. **Remove redundant Nuxt modules.** The layer already provisions UI, fonts, image, and SEO modules. You can remove them from the downstream `nuxt.config.ts` modules array.

## Phase 2: Code Deletion (The Great Purge)

Because the downstream app inherits from the layer, **dozens of files should be completely deleted** from the local app. Do not leave them around or they will shadow the layer and cause bugs.

Delete the following local directories/files if they match the standard templates:

- `app/components/OgImage/` (The layer provides the default OG image templates)
- `app/composables/useSeo.ts` and `app/composables/useSchemaOrg.ts`
- `app/plugins/` (Delete `gtag.client.ts`, `posthog.client.ts`, `csrf.client.ts` as the layer provides them)
- `server/utils/` (Delete `auth.ts`, `database.ts`, `google.ts`, `kv.ts`, `r2.ts`, `rateLimit.ts` unless they contain highly app-specific overrides)
- `server/middleware/` (Delete `csrf.ts`, `d1.ts`)
- `server/api/health.get.ts` and `server/api/indexnow/`
- `tools/` and _ALL root plugin directories_: `eslint-plugins/`, `eslint-plugin-nuxt-guardrails/`, `eslint-plugin-nuxt-ui/`.
- `eslint.config.mjs` (Replace with the minimalist layer inheritor version below)

## Phase 2b: Nuxt Config Deduplication

Because the Layer configures a lot of defaults, you should remove overlapping properties in your downstream `nuxt.config.ts`:

- Delete the `modules` array (unless you have app-specific modules).
- Delete the `nitro.rollupConfig` for `fix-og-image-mock`. The layer abstracts this safely using absolute path fallbacks. Having it locally will cause module resolution errors.
- Delete generic `nitro.externals` if they solely list `drizzle-orm` (the layer handles this).

## Phase 3: Setup Tooling

1. Run the layer's generalized installer using `jiti` to bootstrap any missing pieces:
   ```bash
   npx jiti node_modules/narduk-nuxt-layer/tools/init.ts --name="your-app-name" --display="Display Name" --url="https://domain.com"
   ```
2. Update the local `eslint.config.mjs` to simply extend the layer's config:
   ```js
   // @ts-check
   import withNuxt from './.nuxt/eslint.config.mjs';
   export default withNuxt(
     {
       rules: {
         'vue/multi-word-component-names': 'off',
         '@typescript-eslint/no-explicit-any': 'off',
       },
     },
     { ignores: ['.nuxt/**', '.output/**', 'dist/**', 'node_modules/**', '**/*.d.ts'] }
   );
   ```

## Phase 4: Verification

1. Run `pnpm install` and clean the cache (`rm -rf .nuxt .output`).
2. Start the dev server `pnpm run dev`.
3. Verify the app compiles and Nuxt correctly merges the local `app/` with the layer's `app/`.
4. Run `pnpm run quality` to ensure the extended ESLint plugins and Nuxt typechecks pass successfully.
