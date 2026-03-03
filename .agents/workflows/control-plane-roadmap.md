# Narduk Control Plane — UI/UX & feature roadmap

What a reasonable operator would expect from a fleet dashboard: clear navigation, at-a-glance health, actionable data, and minimal friction.

---

## 1. CSP / third-party scripts (done)

- [x] Allow Cloudflare Insights: `script-src` and (if needed) `connect-src` for `https://static.cloudflareinsights.com`.
- [x] Allow PostHog assets: `script-src` and `connect-src` for `https://us-assets.i.posthog.com`.

---

## 2. Navigation & layout

- **Persistent nav** — Sidebar or top nav with: Dashboard (home), Fleet, Indexing, Settings/Admin. No single long scroll for everything.
- **Breadcrumbs** — When drilling into an app or section, show path (e.g. Dashboard > flashcard-pro > GSC).
- **Default dashboard** — Landing page = summary cards (fleet count, last GSC sync, indexing stats) and quick actions, not only raw forms.

---

## 3. Fleet list & app detail

- **Fleet as first-class section** — Dedicated route (e.g. `/fleet`) with table or card list: app name, production URL, last checked / status, quick actions (GSC, PostHog, IndexNow).
- **App detail page** — `/fleet/[app]`: one place for that app’s GSC, PostHog, IndexNow. Tabs or sections instead of modals so data is linkable and bookmarkable.
- **Health / status** — Per-app or global: “last successful GSC run”, “PostHog reachable”, “IndexNow submitted”. Optional simple uptime or “last deploy” from CI if available.
- **Search / filter** — Filter fleet by name; optional tags (e.g. “marketing”, “internal”) later.

---

## 4. GSC (Search Console)

- **Date range picker** — User chooses start/end (e.g. last 7/30/90 days) instead of fixed 30 days.
- **Dimension selector** — query, page, device, country, searchAppearance in a dropdown.
- **Table view** — GSC rows as a proper table (query/page, clicks, impressions, CTR, position) with sortable columns, not only JSON.
- **Export** — CSV or copy for the current GSC result.
- **Empty / error states** — Clear message when no data or API error; link to GSC or docs if needed.

---

## 5. PostHog

- **Summary cards** — Event count and unique users for the selected app/period as cards, not only raw JSON.
- **Optional time series** — Simple chart (e.g. events per day) if the API supports it or we add a small backend aggregation.
- **Date range** — Align with GSC (shared or per-section date range).
- **Error state** — “PostHog not configured” or API error with short explanation.

---

## 6. IndexNow & Google Indexing

- **IndexNow**
  - Per-app: “Submit sitemap” or “Submit URL list” with optional textarea for URLs (one per line).
  - Show last submit result (success/failure, response summary).
- **Google Indexing**
  - Keep URL submit + status check; add optional “type” selector (URL_UPDATED, URL_DELETED).
  - List or table of “recently submitted URLs” (e.g. last 10) from session or simple backend store so users don’t lose context.
- **Batch actions** — “Submit multiple URLs” (paste list) for Indexing API if quota and API allow.

---

## 7. Auth & access

- **Login / auth** — If `requireAdmin` is used, a real login page (e.g. `/login`) and redirect when unauthenticated, instead of raw 401.
- **Session** — Show “Logged in as …” and Logout in nav when authenticated.
- **Role hint** — If the app ever has roles, show “Admin” or similar in the UI.

---

## 8. Settings & configuration

- **Settings page** — Link to Doppler or env docs; list which integrations are “configured” (GSC, PostHog, Indexing) without revealing secrets.
- **Fleet registry** — If the app list is still code-based, document how to add a new app (file + env) and optionally a simple “Fleet config” read-only view (names + URLs only).

---

## 9. UX polish

- **Loading states** — Skeleton or spinner for every async section (fleet list, GSC, PostHog, IndexNow, Indexing).
- **Toasts / notifications** — Success (“URL submitted”) and error toasts instead of only inline JSON.
- **Responsive** — Usable on tablet; critical actions on mobile (e.g. “Submit URL”).
- **Empty states** — “No fleet apps” / “No GSC data” with one-line next step (e.g. “Check Doppler” or “Add app to registry”).
- **Keyboard / a11y** — Focus order, labels, and “Skip to main content” so the dashboard is navigable by keyboard and screen readers.

---

## 10. Optional / later

- **Audit log** — Who submitted which URL when (if stored server-side).
- **Scheduled jobs** — Cron to ping IndexNow or refresh GSC daily; show “last run” in UI.
- **Alerts** — Optional “notify me if GSC fails” or “if event count drops” (email/Slack later).
- **Fleet tags** — Group apps by product or team for filtering.

---

## Implementation order (suggested)

1. **CSP** — Done in layer.
2. **Layout** — Add default layout with sidebar or top nav and Dashboard/Fleet/Indexing links.
3. **Fleet route** — `/fleet` list + `/fleet/[app]` detail with GSC/PostHog/IndexNow in tabs.
4. **GSC table + date/dimension** — Replace raw JSON with table and controls.
5. **PostHog summary cards** — Replace raw JSON with cards.
6. **IndexNow/Indexing UX** — Toasts, optional URL list, type selector.
7. **Auth** — Login page and session display if using `requireAdmin`.
8. **Settings** — Config status page and fleet registry doc/view.
9. **Polish** — Loading, empty states, responsive, a11y.

This order fixes blocking issues first (CSP), then structure (layout, routes), then data presentation (tables, cards), then auth and configuration, then polish.
