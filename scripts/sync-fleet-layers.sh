#!/bin/bash
set -e

TEMPLATE_APPS_DIR="/Users/narduk/new-code/template-apps"
SKIP_APP="narduk-enterprises-portfolio"

echo "🚀 Starting fleet-wide layer synchronization..."

for APP_DIR in "$TEMPLATE_APPS_DIR"/*; do
  if [ -d "$APP_DIR" ]; then
    APP_NAME=$(basename "$APP_DIR")
    
    if [ "$APP_NAME" == "$SKIP_APP" ]; then
      echo "⏭ Skipping $APP_NAME (locked in active git rebase)"
      continue
    fi
    
    if [ "$APP_NAME" == "control-plane" ]; then
      echo "⏭ Skipping control-plane (already updated and deployed)"
      continue
    fi

    echo ""
    echo "====================================================="
    echo "📦 Processing: $APP_NAME"
    echo "====================================================="
    
    cd "$APP_DIR" || continue
    
    # Check if there are uncommitted changes to prevent losing work
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo "⚠️  Uncommitted changes detected in $APP_NAME!"
      echo "   Stashing changes before update..."
      git stash
      STASHED=1
    else
      STASHED=0
    fi

    echo "📥 Running update-layer..."
    # The update-layer script automatically stages the changes
    pnpm run update-layer
    
    echo "💾 Committing the update..."
    # If the layer was already up to date, it might not have changes to commit, so we use || true
    git commit -m "chore: sync layer with template to fix GA tracking snippet" || echo "No changes to commit"
    
    echo "⬆️ Pushing changes..."
    git push origin main || echo "Failed to push $APP_NAME, moving on..."

    echo "🚀 Deploying $APP_NAME to Cloudflare..."
    # Run the deployment using Doppler PRD config
    doppler run --project "$APP_NAME" --config prd -- pnpm run deploy || echo "Deploy failed for $APP_NAME"
    
    if [ "$STASHED" -eq 1 ]; then
      echo "🔄 Restoring stashed changes..."
      git stash pop || echo "Failed to pop stash for $APP_NAME"
    fi

    echo "✅ Finished $APP_NAME"
  fi
done

echo ""
echo "🎉 Fleet synchronization complete!"
