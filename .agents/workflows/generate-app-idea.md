---
description: Generate an app idea suited for the stack and create an agent prompt to build it
---

This workflow helps you brainstorm app ideas that perfectly fit the template's architecture (Nuxt 4, Cloudflare Workers, D1, Nuxt UI 4), bootstrap a new repo, and generate a prompt for another agent to build the app while auditing the template.

## Step 1: Brainstorm App Ideas

1. Consider what the `narduk-nuxt-template` provides:
   - **Full-stack SSR** (Nuxt 4 + Cloudflare Workers)
   - **SQL database** (Cloudflare D1 via Drizzle ORM)
   - **Rich UI components** (Nuxt UI 4, Tailwind v4)
   - **Monorepo architecture** (apps + shared packages)
2. Generate **10** short, diverse app ideas. Each idea should be 1–2 sentences max. Aim for variety across categories like:
   - Dashboards & analytics
   - Productivity & project management
   - Social & community
   - Marketplaces & directories
   - Content & publishing
   - Utilities & developer tools
   - Personal finance & tracking
   - Health, fitness & habits
   - Education & learning
   - Creative & media
3. Present all 10 to the user and let them pick (or remix).

## Step 2: Bootstrap the Repository

Once the user selects an app idea, **you** (the current agent) perform the bootstrap directly:

// turbo-all

1. Create a new private GitHub repo:
   ```bash
   gh repo create loganrenz/<app-name> --private --confirm
   ```
2. Clone the template:
   ```bash
   gh repo clone loganrenz/narduk-nuxt-template ~/new-code/<app-name>
   ```
3. Set the new repo as origin:
   ```bash
   cd ~/new-code/<app-name>
   git remote remove origin
   git remote add origin https://github.com/loganrenz/<app-name>.git
   ```
4. Install dependencies:
   ```bash
   cd ~/new-code/<app-name> && pnpm install
   ```

**Do NOT run `pnpm setup`.** That will be handled by the next agent in the project workspace.

## Step 3: Generate the Build Prompt and Copy to Clipboard

Generate a single prompt for the user to paste into a new Antigravity window opened at `~/new-code/<app-name>`. Copy it to the clipboard using `pbcopy`.

The prompt **must** contain three sections:

### Section 1: Project Setup

Instruct the agent to run `pnpm setup` with explicit parameters:

```
pnpm setup -- --name="<app-name>" --display="<Display Name>" --url="https://<app-name>.narduk.workers.dev"
```

- `--name`: lowercase kebab-case slug (must match `/^[a-z0-9][a-z0-9-]*$/`)
- `--display`: human-readable name for SEO, favicons, and UI
- `--url`: production URL for site config, OG tags, and Doppler

Then instruct the agent to read `AGENTS.md` and `tools/BUILD_TEST_APP.md` (if they exist).

### Section 2: Build the App

Define the specific features:

- **Database Schema:** Tables, columns, and Drizzle models in `packages/db`.
- **API Routes:** Nitro/Worker endpoints, D1 interactions, validation logic.
- **Frontend UI:** Pages, components, design requirements using Nuxt UI 4 and the `base` layer design system.

### Section 3: Template Audit & Issue Reporting

Instruct the agent to create `audit_report.md` capturing friction across:

- **Initialization:** `pnpm setup` results, string replacements, missing dependencies.
- **Database & CLI:** Drizzle migrations, `wrangler`, `nitro-cloudflare-dev` binding.
- **Monorepo Layers:** Module resolution, layer inheritance issues.
- **Type Safety:** TypeScript errors, auto-import type failures.
- **Agent Experience:** Adequacy of `AGENTS.md` and documentation.
- **Other Friction:** Port collisions, Tailwind issues, Doppler token errors.

## Step 4: Tell the User

After copying the prompt to clipboard, tell the user:

> Bootstrap complete! Open `~/new-code/<app-name>` in a new Antigravity window and paste (Cmd+V).

---

## Example Prompt Template

```markdown
# Role and Objective

You are an expert Nuxt 4, Cloudflare Workers, and Vue developer. You have been dropped into a newly cloned monorepo based on `narduk-nuxt-template`.

**You have a dual mission:**

1. **Build "[App Name]"**: [app description] using Nuxt 4, Cloudflare D1, and Nuxt UI 4.
2. **Template Audit**: Report any friction, broken types, or tooling failures.

---

## Step 0: Project Setup

Run the setup script (the script is NOT interactive):
```

pnpm setup -- --name="<app-name>" --display="<Display Name>" --url="https://<app-name>.narduk.workers.dev"

```

Then read `AGENTS.md` and `tools/BUILD_TEST_APP.md` if they exist.

---

## Mission 1: Build [App Name]

Build the app inside `apps/web`. Features:

**1. Database Schema (Cloudflare D1)**
- [table details...]

**2. API Routes (Nitro / Cloudflare Workers)**
- [endpoint details...]

**3. Frontend (Nuxt UI 4)**
- [UI requirements...]
- **Requirement:** Use the `base` layer design tokens, Nuxt UI 4 components, and Tailwind v4.

---

## Mission 2: Template Audit & Issue Reporting

Create `audit_report.md` answering:
1. Did `pnpm setup` complete smoothly?
2. Did Drizzle migration and `nitro-cloudflare-dev` work out of the box?
3. Did Nuxt layer inheritance work seamlessly?
4. Any pre-existing TypeScript errors from `pnpm typecheck`?
5. Did documentation accurately guide you?
6. Any HMR port collisions, Tailwind issues, or Doppler errors?

### Final Deliverable:
- Working code for [App Name] with **ZERO errors and ZERO warnings** (TypeScript, ESLint, Build).
- `audit_report.md` with brutally honest feedback.

**CRITICAL RULE:** If you encounter errors or warnings, you must fix them properly. Do NOT use hacky monkey fixes, `@ts-expect-error`, or suppressions. Solve the actual root cause.
```
