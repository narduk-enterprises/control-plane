---
description:
  Apply a code change across all template apps in ~/new-code/template-apps
---

# Apply a Change to All Template Apps

Applies an arbitrary code change (file edit, config update, dependency bump,
etc.) to every template-derived app in `~/new-code/template-apps/`.

> [!IMPORTANT] This workflow iterates over **local checkouts**. Make sure the
> repos are cloned and up-to-date before running.

---

## 0. Pre-flight — clarify the change

Ask the user:

1. **What change?** — Get a precise description of the change to apply (e.g.
   "add `noExternal: ['foo']` to `nuxt.config.ts`", "bump `@nuxt/ui` to
   4.1.0", "add a new file `server/utils/audit.ts`").
2. **Which apps?** — All apps, or a specific subset? (default: all)
3. **Skip list?** — Any apps to exclude? `control-plane` is always excluded by
   default since it has its own structure.
4. **Commit message?** — What commit message to use (e.g.
   `fix: add missing noExternal for foo`).
5. **Push & deploy?** — Should we also `git push` and/or deploy after
   committing? (default: commit only, no push)

---

## 1. Discover apps

// turbo

```bash
ls -1d ~/new-code/template-apps/*/ | xargs -I{} basename {} | grep -v control-plane | sort
```

Review the list with the user. Confirm final skip list.

---

## 2. Apply the change to each app

For **each app** in the list (substitute `<app>` with the app directory name):

### 2a. Ensure clean working tree

```bash
cd ~/new-code/template-apps/<app> && git status --short
```

If dirty, ask the user whether to stash, skip, or abort.

### 2b. Apply the change

This step varies by change type. Examples:

**File edit (sed/patch):**

```bash
cd ~/new-code/template-apps/<app> && sed -i '' 's/old-pattern/new-pattern/' path/to/file
```

**Add a new file:**

```bash
cd ~/new-code/template-apps/<app> && mkdir -p path/to && cat > path/to/newfile.ts << 'EOF'
// file contents here
EOF
```

**Dependency bump:**

```bash
cd ~/new-code/template-apps/<app> && pnpm update <package>@<version>
```

**Multi-file code change (agent-driven):** If the change requires reading
context and making intelligent edits (not a simple find-replace), apply the
change manually using code editing tools for each app, adapting to the app's
existing code.

> [!TIP] For simple, identical changes across all apps, write a one-off shell
> loop instead of repeating step 2 manually:
>
> ```bash
> for app in ~/new-code/template-apps/*/; do
>   name=$(basename "$app")
>   [[ "$name" == "control-plane" ]] && continue
>   echo "--- $name ---"
>   cd "$app"
>   # Apply change here, e.g.:
>   # sed -i '' 's/old/new/' nuxt.config.ts
>   cd -
> done
> ```

### 2c. Verify the change

// turbo

```bash
cd ~/new-code/template-apps/<app> && git diff --stat
```

Optionally run a quick quality check:

```bash
cd ~/new-code/template-apps/<app> && pnpm quality
```

### 2d. Commit

```bash
cd ~/new-code/template-apps/<app> && git add -A && git commit -m "<commit-message>"
```

### 2e. (Optional) Push

```bash
cd ~/new-code/template-apps/<app> && git push origin main
```

### 2f. (Optional) Deploy

```bash
cd ~/new-code/template-apps/<app> && doppler run --project "<app>" --config prd -- pnpm run deploy
```

---

## 3. Batch mode — full loop script

For simple, mechanical changes, run everything as a single script.
**Customize the `APPLY_CHANGE` block before running.**

```bash
#!/bin/bash
set -e

FLEET_DIR="$HOME/new-code/template-apps"
SKIP_APPS="control-plane"
COMMIT_MSG="chore: <describe the change>"
PUSH=false    # set to true to push
DEPLOY=false  # set to true to deploy

for APP_DIR in "$FLEET_DIR"/*/; do
  APP=$(basename "$APP_DIR")
  
  # Skip excluded apps
  if echo "$SKIP_APPS" | grep -qw "$APP"; then
    echo "⏭  Skipping $APP"
    continue
  fi

  echo ""
  echo "====================================================="
  echo "📦 Processing: $APP"
  echo "====================================================="

  cd "$APP_DIR"

  # Stash if dirty
  STASHED=0
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "⚠️  Stashing uncommitted changes..."
    git stash
    STASHED=1
  fi

  # ─── APPLY CHANGE HERE ───
  # Example: sed -i '' 's/old-pattern/new-pattern/' nuxt.config.ts
  # Example: cp /tmp/new-util.ts server/utils/new-util.ts
  # ──────────────────────────

  # Commit
  git add -A
  git commit -m "$COMMIT_MSG" || echo "  No changes to commit"

  # Push
  if [ "$PUSH" = true ]; then
    git push origin main || echo "  Push failed for $APP"
  fi

  # Deploy
  if [ "$DEPLOY" = true ]; then
    doppler run --project "$APP" --config prd -- pnpm run deploy || echo "  Deploy failed for $APP"
  fi

  # Restore stash
  if [ "$STASHED" -eq 1 ]; then
    git stash pop || echo "  Failed to pop stash for $APP"
  fi

  echo "✅ Finished $APP"
done

echo ""
echo "🎉 Fleet-wide change complete!"
```

---

## 4. Post-flight — summary

After all apps are processed, print a summary:

// turbo

```bash
for app in ~/new-code/template-apps/*/; do
  name=$(basename "$app")
  [[ "$name" == "control-plane" ]] && continue
  echo "$name: $(cd "$app" && git log -1 --oneline)"
done
```

Review the output to confirm the change landed in every app.
