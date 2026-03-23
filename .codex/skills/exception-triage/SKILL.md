---
name: exception-triage
description:
  Decide whether to fix a guardrail issue or add a tracked temporary exception
---

# exception-triage

Use when a lint, type, or repo guardrail violation appears and you need to
choose between a code fix and a temporary suppression.

## Default

Fix the code. Add an exception only when the exception is clearly safer than the
change and the root cause is already tracked.

## Exception Policy

- Put tracked suppressions in `guardrail-exceptions.json`.
- Require `file`, `rule`, `reason`, `owner`, `createdAt`, and `expiresAt`.
- Use short expiries. Renew only if the follow-up fix is still blocked.
- Prefer removing existing exceptions over adding new ones.

## Triage Order

1. Can the code be corrected locally?
2. Can the pattern be moved into shared tooling?
3. Can the issue be handled by ESLint instead of a suppression?
4. If not, add a temporary exception with an owner and expiry.
