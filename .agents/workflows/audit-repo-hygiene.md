---
description: Full repository sweep for secrets, junk files, duplicated code, and misplaced content
---

This workflow performs a comprehensive audit of the monorepo to find files that do not belong. Run this periodically or after major migrations. Report findings grouped by severity.

1. **Scan for secrets and credential files on disk**
   - Look for private keys, API tokens, service account JSON, `.env` files with real values, and Doppler artifacts that should never be committed.
     // turbo
     `find . -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.nuxt/*" -not -path "*/.output/*" -type f \( -name "*secret*" -o -name "*credential*" -o -name "*.pem" -o -name "doppler.json" \) 2>/dev/null`
   - Check for `.env` files that contain real (non-placeholder) values:
     // turbo
     `find . -not -path "*/node_modules/*" -not -path "*/.git/*" -name ".env*" -exec grep -l -E "(phc_|phx_|sk_|pk_|PRIVATE_KEY)" {} \; 2>/dev/null || echo "No .env files with real secrets (pass)"`
   - **Verify none of these are tracked by git:**
     // turbo
     `git ls-files --cached -- '*secret*' '*credential*' '*.pem' 'doppler.json' '.env' '.env.*' '*.jsonl' 2>/dev/null | head -20 || echo "None tracked (pass)"`
   - If ANY are git-tracked, flag as **CRITICAL** — the secret must be rotated after removal.

2. **Scan for junk and stale artifacts**
   - Find logs, backup files, OS metadata, and stale output files:
     // turbo
     `find . -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.nuxt/*" -not -path "*/.output/*" -not -path "*/.wrangler/*" -not -path "*/.data/*" -type f \( -name "*.log" -o -name "*.bak" -o -name "*.tmp" -o -name "*.orig" -o -name "*.swp" -o -name ".DS_Store" -o -name "Thumbs.db" -o -name "lint-results*" -o -name "*.jsonl" \) 2>/dev/null`
   - All of these should be deleted and their patterns confirmed in `.gitignore`.

3. **Check for duplicate directories across workspaces**
   - Directories like `.agents`, `.cursor`, `.github`, `eslint-plugins`, and `tools` should exist in only ONE canonical location (root or layer), not duplicated into downstream apps.
     // turbo
     `for dir in .agents .cursor .github eslint-plugins tools; do echo "=== $dir ===" && find . -maxdepth 4 -name "$dir" -type d -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.nuxt/*" 2>/dev/null; done`
   - For each duplicate found, `diff` it against the canonical copy to confirm it's identical:
     `diff -rq <canonical>/<dir> <duplicate>/<dir>`
   - If identical, delete the duplicate. If different, investigate which version is authoritative.

4. **Check for orphaned lockfiles in sub-workspaces**
   - In a pnpm monorepo, only the ROOT should have a `pnpm-lock.yaml`. Sub-workspace lockfiles cause resolution conflicts.
     // turbo
     `find . -name "pnpm-lock.yaml" -not -path "*/node_modules/*" -not -path "./.git/*" -not -path "./pnpm-lock.yaml" 2>/dev/null || echo "No orphaned lockfiles (pass)"`
   - Layer workspaces MAY have their own `pnpm-workspace.yaml` if they declare internal sub-packages (e.g., ESLint plugins). This is acceptable. But a `pnpm-lock.yaml` inside a layer is not.

5. **Check for files that the Nuxt Layer already provides**
   - After migration, downstream apps should NOT contain files that shadow the layer. Check for common offenders:
     // turbo
     `for f in "app/plugins/gtag.client.ts" "app/plugins/posthog.client.ts" "app/plugins/csrf.client.ts" "app/composables/useSeo.ts" "app/composables/useSchemaOrg.ts" "server/utils/auth.ts" "server/utils/database.ts" "server/utils/r2.ts" "server/utils/rateLimit.ts" "server/middleware/csrf.ts" "server/middleware/d1.ts" "server/api/health.get.ts"; do find apps/ -path "*/$f" 2>/dev/null; done || echo "No shadowed layer files found (pass)"`
   - If found, verify they are not app-specific overrides. If they match the layer's version, delete them.

6. **Verify `.gitignore` coverage**
   - Ensure the root `.gitignore` covers all the patterns found above:
     // turbo
     `grep -c "DS_Store\|\.env\|secret\|doppler.json\|\.jsonl\|lint-result\|\.log" .gitignore || echo "Some patterns may be missing"`
   - Recommend additions for any gaps found.

7. **Compile and present findings**
   - Group all findings into severity tiers:
     - 🔴 **Critical** — Secrets, private keys, credentials (tracked or untracked)
     - 🟠 **High** — Duplicate directories, shadowed layer files, orphaned lockfiles
     - 🟡 **Medium** — Junk files, stale artifacts, `.DS_Store`
     - 🟢 **Low** — `.gitignore` gaps, nice-to-have cleanups
   - Present as a table with file path, description, and recommended action.
   - Ask the user for approval before deleting anything.
