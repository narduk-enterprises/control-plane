---
name: fleet-guardrails
description: Audit and repair fleet app guardrails, drift, and exception hygiene
---

# fleet-guardrails

Use when checking fleet apps for stale workflows, guardrail drift, exception
sprawl, or unsafe rollout behavior.

## Workflow

1. Start with `pnpm run audit:fleet-guardrails` from the template repo root.
2. Group findings into code fixes, template fixes, shared-package fixes, and
   temporary exceptions.
3. Prefer fixing the template, layer, or shared package over patching one app at
   a time.
4. When touching fleet repos, never overwrite unrelated local edits.
5. Commit only clean repos. Leave dirty repos for manual review.

## Exception Rules

- Use `guardrail-exceptions.json` for tracked suppressions.
- Every exception needs `file`, `rule`, `reason`, `owner`, `createdAt`, and
  `expiresAt`.
- Treat exceptions as temporary. Remove them once the root cause is fixed.
