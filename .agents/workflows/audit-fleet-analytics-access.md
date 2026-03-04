---
description: Audit fleet apps for GA4 and GSC service account access — verifies live API permissions, not just key presence
---

# Fleet Analytics Access Audit

This workflow verifies that the service account `analytics-admin@narduk-analytics.iam.gserviceaccount.com` has **live API access** to GA4 and GSC for every fleet app. This goes beyond checking Doppler key presence — it actually hits the APIs.

## Prerequisites

- Dev server running: `pnpm dev` (from the control-plane monorepo root)
- Doppler configured with valid `GSC_SERVICE_ACCOUNT_JSON` and `GA_PROPERTY_ID`

## Steps

### 1. Run the Integration Tests

// turbo
```bash
pnpm run test:e2e
```

Review the output. Any **403 Forbidden** or **404 Not Found** failures indicate missing permissions.

### 2. For GA4 403 Errors

The error message will include the GA4 **Property ID** (e.g., `467975412`).

**Fix (manual — first time only):**
1. Go to [Google Analytics](https://analytics.google.com)
2. Select the property matching the ID in the error
3. Navigate to **Admin → Property Access Management**
4. Click **+** → **Add users**
5. Enter: `analytics-admin@narduk-analytics.iam.gserviceaccount.com`
6. Set role to **Viewer**
7. Click **Add**

**Why it can't be fully automated:** The GA Admin API requires Admin-level access to grant new users. The initial grant must be done manually. Once the service account has Admin role, future grants can be automated via the `analyticsadmin.googleapis.com` API.

### 3. For GSC 403 Errors

The error message will include the **site URL** (e.g., `https://neon-sewer-raid.nard.uk`).

**Fix:**
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add the property if not already added
3. Navigate to **Settings → Users and permissions**
4. Add `analytics-admin@narduk-analytics.iam.gserviceaccount.com` as **Owner**

**Alternatively**, use the existing GSC toolbox if available:
```bash
tsx tools/gsc-toolbox.ts verify-site --url https://APP_NAME.nard.uk
```

### 4. For Indexing API 404 Errors

This means the URL hasn't been submitted to the Indexing API yet. This is expected for new apps and is **not a permission issue**.

### 5. Verify Fixes

After granting access (wait 2–3 minutes for propagation):

// turbo
```bash
pnpm run test:e2e
```

All 12 tests should pass with `200 OK`.

## Fleet Access Checklist

For each fleet app, verify:

| Check | Tool | Expected |
|-------|------|----------|
| GA4 Viewer access | `GET /api/fleet/ga/:app` | 200 with `summary` |
| GSC Owner access | `GET /api/fleet/gsc/:app` | 200 with `app` |
| Indexing API access | `GET /api/fleet/indexing/status?url=...` | 200 or 404 (no data yet) |
| PostHog configured | `GET /api/fleet/posthog/:app` | 200 with `summary` |

## Reference

- Service Account: `analytics-admin@narduk-analytics.iam.gserviceaccount.com`
- GA4 Account ID: `377883200`
- Full analytics architecture: `.agents/app-standardization/analytics-architecture.md`
- Fleet registry: `apps/web/server/data/fleet-registry.ts`
