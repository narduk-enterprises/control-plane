---
name: shared-package-release
description: Release and roll out shared guardrail packages like eslint config
---

# shared-package-release

Use when changing `packages/eslint-config` or any other shared package that must
be versioned, pushed, and rolled through the template and fleet.

## Workflow

1. Make the package change and run its local tests/build.
2. Update the package version, commit, tag, and push in the package repo.
3. Update the template dependency to the new version.
4. Roll the template forward and sync the fleet.
5. Re-run the relevant repo audits after rollout.

## Guardrails

- Keep the shared package authoritative. Do not fork the same rule in template
  code unless the package cannot express it yet.
- Prefer one release per logical guardrail change.
- If a release breaks fleet apps, fix the shared package first, then re-roll.
