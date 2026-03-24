#!/usr/bin/env sh
set -eu

MODE=${1:-links-only}
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
TARGET="../.agents/skills"
LOCAL_SOURCE="${HOME}/.agents/skills"

cd "$ROOT_DIR"

ensure_links() {
  if [ ! -d .agents/skills ] || [ -L .agents/skills ]; then
    return 0
  fi

  find .agents/skills \
    -type d \
    \( -name .git -o -name __pycache__ -o -name .pytest_cache -o -name node_modules \) \
    -prune \
    -exec rm -rf {} \;

  find .agents/skills \
    -type f \
    \( -name .DS_Store -o -name '*.pyc' \) \
    -exec rm -f {} \;

  for root in .agent .cursor .codex .claude .github; do
    mkdir -p "$root"

    if [ -L "$root/skills" ] && [ "$(readlink "$root/skills")" = "$TARGET" ]; then
      continue
    fi

    rm -rf "$root/skills" 2>/dev/null || true
    (
      cd "$root"
      ln -s "$TARGET" skills
    )
  done
}

origin_default_ref() {
  git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null || printf '%s\n' refs/remotes/origin/main
}

should_vendor_for_upstream_head() {
  current_commit=$(git rev-parse -q --verify HEAD 2>/dev/null || true)
  [ -n "$current_commit" ] || return 1

  default_ref=$(origin_default_ref)
  default_branch=${default_ref#refs/remotes/origin/}
  current_branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)

  if [ -n "$current_branch" ] && [ "$current_branch" != "$default_branch" ]; then
    return 1
  fi

  default_commit=$(git rev-parse -q --verify "$default_ref" 2>/dev/null || true)
  if [ -n "$default_commit" ] && [ "$current_commit" = "$default_commit" ]; then
    return 0
  fi

  if [ "$default_ref" != "refs/remotes/origin/main" ]; then
    main_commit=$(git rev-parse -q --verify refs/remotes/origin/main 2>/dev/null || true)
    if [ -n "$main_commit" ] && [ "$current_commit" = "$main_commit" ]; then
      return 0
    fi
  fi

  return 1
}

vendor_skills() {
  if [ ! -d "$LOCAL_SOURCE" ] || [ ! -d .agents/skills ] || [ -L .agents/skills ]; then
    return 0
  fi

  if ! command -v rsync >/dev/null 2>&1; then
    return 0
  fi

  rsync -a --delete --exclude '.DS_Store' "$LOCAL_SOURCE/" .agents/skills/
}

case "$MODE" in
  links-only)
    ensure_links
    ;;
  vendor)
    vendor_skills
    ensure_links
    ;;
  vendor-if-upstream-head)
    if should_vendor_for_upstream_head; then
      vendor_skills
    fi
    ensure_links
    ;;
  *)
    printf 'Usage: %s [links-only|vendor|vendor-if-upstream-head]\n' "$0" >&2
    exit 1
    ;;
esac
