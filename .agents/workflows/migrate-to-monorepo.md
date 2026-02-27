---
description: Migrate a flat Nuxt 4 app from ~/code into the nuxt-v4-template monorepo architecture
---

# Migrate Existing Repo to Monorepo Template

> **Scope:** This workflow converts a flat Nuxt 4 application (one of the ~10 repos in `~/code`) into a **new repository** by cloning the `nuxt-v4-template` monorepo scaffold and copying the app code into `apps/web/`.

// turbo-all

---

## Prerequisites — Confirm Before Starting

1. Read `~/code/nuxt-v4-template/AGENTS.md` in full. This is the golden reference.
2. Determine if the source repo is a Nuxt 4 app (has `nuxt.config.ts`). If not, STOP and notify the user.
3. Identify the source repo name, e.g. `papa-everetts-pizza`. Determine the new project name, e.g. `papa-everetts-pizza-v2`.

---

## Phase 0: Scaffold the New Repo

1. Clone the template into a **new directory** with the project name:
   ```bash
   git clone https://github.com/loganrenz/nuxt-v4-template.git ~/code/<project-name>-v2
   cd ~/code/<project-name>-v2
   rm -rf .git
   git init && git add . && git commit -m "chore: scaffold from nuxt-v4-template"
   ```
2. Run the init script to rename everything:
   ```bash
   pnpm install
   npx jiti tools/init.ts --name="<project-name>" --display="<Display Name>" --url="https://<domain>"
   ```
   _Note: The init script will output some "Next steps" (like Doppler setup)._
3. **Automate Doppler Setup**: Initialize Doppler for the project using the new generic name:
   ```bash
   doppler setup --project <project-name> --config dev
   ```
4. Verify the scaffold compiles cleanly:
   ```bash
   pnpm install && pnpm run dev
   ```
   Kill the dev server once it starts successfully.

---

## Phase 1: Inventory the Source Repo

Before moving ANY files, audit the source repo (`~/code/<source>`) to categorize every file.

### 1a. Files That the Layer Already Provides (DELETE / DO NOT COPY)

These exist identically in `layers/narduk-nuxt-layer/` and must **not** be duplicated into the new app:

- `app/composables/useSeo.ts` and `app/composables/useSchemaOrg.ts`
- `app/components/OgImage/*`
- `app/plugins/gtag.client.ts`, `app/plugins/posthog.client.ts`, `app/plugins/csrf.client.ts`
- `server/utils/` (`auth.ts`, `database.ts`, `google.ts`, `kv.ts`, `r2.ts`, `rateLimit.ts` - unless heavily customized)
- `server/middleware/csrf.ts`, `server/middleware/d1.ts`
- `server/api/health.get.ts`, `server/api/indexnow/*`

### 1b. Files That Belong in `apps/web/` (MOVE)

These files contain the specific business logic and should be copied:

- `app/pages/**`, `app/components/**` (only app-specific ones), `app/composables/**` (app-specific), `app/layouts/**`, `app/middleware/**`
- `app/assets/css/main.css` (app-specific theme customizations)
- `app/app.vue`, `app/error.vue`, `app/app.config.ts`
- `content/**` and `content.config.ts` (if using Nuxt Content)
- `server/api/**` (app-specific routes only)
- `server/database/schema.ts` (app-specific schema, extending base schema)
- `public/**`
- `drizzle/**` (app-specific migrations)
- `scripts/**` (app-specific scripts)

### 1c. Files to DELETE Entirely (Junk / Superseded)

- `.env*`, `.dev.vars` (Doppler replaces these)
- All ESLint plugin directories (`eslint-plugin-nuxt-ui/`, etc.) — these are now in `packages/eslint-config/`
- Massive `eslint.config.mjs` — replaced by slim layer version
- `.cursorrules`, `.cursor/` — agent config replaced by `AGENTS.md`
- Lint reports, `.eslint-results.json`, logs, temp artifacts, old workspace configs, package lock files

---

## Phase 2: Move App-Specific Files

Execute commands to selectively copy code from the old repo to the new `apps/web/` directory.

1. **Copy app-specific source files:**

   ```bash
   # Make sure you are in the new repo
   cd ~/code/<project-name>-v2

   # Pages, components, layouts, composables, middleware
   cp -R ~/code/<source>/app/pages/* apps/web/app/pages/ || true
   cp -R ~/code/<source>/app/components/* apps/web/app/components/ || true
   cp -R ~/code/<source>/app/layouts/* apps/web/app/layouts/ || true
   cp -R ~/code/<source>/app/composables/* apps/web/app/composables/ || true
   cp -R ~/code/<source>/app/middleware/* apps/web/app/middleware/ || true

   # Static assets and Content
   cp -R ~/code/<source>/public/* apps/web/public/ || true
   if [ -d ~/code/<source>/content ]; then cp -R ~/code/<source>/content apps/web/content; fi
   ```

2. **Automate App-Specific CSS & Vue merges:**
   You should use your file editing tools to automatically implement these updates:
   - Read `~/code/<source>/app/assets/css/main.css` and merge ONLY the app-specific `@theme` tokens or custom utilities into `apps/web/app/assets/css/main.css`.
   - Read `~/code/<source>/app/app.vue` and copy any app-specific global providers or schema setup into `apps/web/app/app.vue`.
3. **Copy app-specific server code & migrations:**
   ```bash
   cp -R ~/code/<source>/server/api/* apps/web/server/api/ || true
   cp ~/code/<source>/drizzle/*.sql apps/web/drizzle/ || true
   ```

   - **Automate Schema Merge**: Read `~/code/<source>/server/database/schema.ts` and merge any custom tables into `apps/web/server/database/schema.ts` using your code editing tools.

---

## Phase 3: Rewrite Configuration

### 3a. `apps/web/nuxt.config.ts`

The new `nuxt.config.ts` must be **slim**.
**DELETE overrrides** already handled by the layer:

- `modules` array (unless strictly app-specific)
- `css`, `devtools`, `ui`, `colorMode`
- `nitro.preset`, `nitro.esbuild`, `nitro.externals`, `nitro.rollupConfig`
- `image.provider`, `ogImage.defaults`
- `compatibilityDate`, `future.compatibilityVersion`

**KEEP ONLY:**

- `extends: ['../../layers/narduk-nuxt-layer']`
- `runtimeConfig` (app-specific env vars)
- `site` (metadata), `schemaOrg.identity`, `image.cloudflare.baseURL`
- `app.head` (meta tags, favicons)
- `sitemap` exclusions, `robots` rules

### 3b. `apps/web/package.json`

Remove all UI, formatting, and layer dependencies (`@nuxt/ui`, `drizzle-orm`, `tailwindcss`, ESLint plugins, etc.). The new package.json should be extremely simple:

```json
{
  "dependencies": {
    "@narduk/eslint-config": "workspace:*",
    "nuxt": "^4.3.1"
    // + any strictly app-specific deps (e.g., "cheerio")
  },
  "devDependencies": {
    "eslint": "^10.0.2",
    "typescript": "^5.9.3",
    "vue-tsc": "^3.2.5",
    "wrangler": "^4.20.0"
  }
}
```

### 3c. `apps/web/eslint.config.mjs`

Replace with the slim workspace version:

```js
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';
import { sharedConfigs } from '@narduk/eslint-config';
export default withNuxt(...sharedConfigs);
```

### 3d. `apps/web/wrangler.json`

The init script already created this. Update only the `d1_databases` array if the app has specific D1 database bindings:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<project-name>-db",
      "database_id": "<real-id-from-old-wrangler>",
      "preview_database_id": "DB"
    }
  ]
}
```

Add any `r2_buckets` bindings if the source app had them.

---

## Phase 4: Handle GitHub Actions and Clean Up

1. **Deploy Workflow:** The `.github/workflows/deploy.yml` is already scaffolded. Ensure `DOPPLER_TOKEN` is set as a GitHub Action secret in the new repo.
2. **Remove Examples App:** If this is a production project, delete the generic examples app shipped with the template:
   ```bash
   rm -rf apps/examples
   ```
   _(Ensure you update `pnpm-workspace.yaml` if it had explicit references, though `apps/_` glob usually handles this).\*
3. **Delete Leftovers:**
   ```bash
   find apps/web -name "*.bak" -delete
   find apps/web -name ".DS_Store" -delete
   ```

---

## Phase 5: Verification

1. Install, clean, and build plugins:
   ```bash
   pnpm install
   rm -rf apps/web/.nuxt apps/web/.output
   pnpm run build:plugins
   ```
2. Start the dev server:
   ```bash
   pnpm run dev
   ```
   _Verify the app compiles, pages render, and the layer merges correctly._
3. Run quality checks:
   ```bash
   pnpm run quality
   ```
   _Fix any lint or type errors._
4. Seed the database (if applicable):
   ```bash
   pnpm --filter web run db:migrate
   pnpm --filter web run db:seed
   ```
5. Commit:
   ```bash
   git add .
   git commit -m "feat: migrate <source-repo> to monorepo architecture"
   ```

---

## Phase 6: Post-Migration Audits

Run the quality agent slash commands to validate the final state:

```bash
# In the agent: use /check-architecture, /check-ssr-hydration-safety, etc.
```

| Workflow                      | Check                                           |
| ----------------------------- | ----------------------------------------------- |
| `/check-layer-health`         | Layer inheritance, shadowed files, config drift |
| `/check-architecture`         | Thin components / thick composables             |
| `/check-ui-styling`           | Tailwind v4 tokens, Nuxt UI v4 compliance       |
| `/check-seo-compliance`       | useSeo, Schema.org, OG images on every page     |
| `/check-ssr-hydration-safety` | SSR safety, window access, ClientOnly           |
| `/audit-repo-hygiene`         | Secrets, junk files, duplicated code            |

---

## Phase 7: Retire Old Directory

Once the migration is fully verified, audits have passed, and the new monorepo app is working as expected, delete the old source directory to clean up your workspace:

```bash
rm -rf ~/code/<source>
```

---

## Decision Matrix: What Goes Where

| Question                                | Answer                        |
| --------------------------------------- | ----------------------------- |
| Is this shared across all Narduk apps?  | → `layers/narduk-nuxt-layer/` |
| Is this an ESLint rule or plugin?       | → `packages/eslint-config/`   |
| Is this a root-level automation script? | → `tools/`                    |
| Is this app-specific UI/logic?          | → `apps/web/app/`             |
| Is this an app-specific API endpoint?   | → `apps/web/server/`          |
| Is this a CI/CD workflow?               | → `.github/workflows/`        |
| Is this an agent quality workflow?      | → `.agents/workflows/`        |
