# Hydration Mismatch Case File

## Case 1: Dashboard — UButton disabled attribute mismatch

- **Route:** `/`
- **Warning:** `Hydration attribute mismatch: disabled`
- **Component Stack:** `Primitive → ULinkBase → NuxtLink → ULink → UButton → UCard → Index`
- **Bucket:** C — Conditional rendering differs SSR vs CSR
- **Root Cause:** `isLoading` from `useFleet()` is `false` during SSR (data hasn't loaded), but becomes `true` during client hydration when the fetch fires. The `:disabled="isLoading"` on UButton renders `disabled` attr only on client.
- **Fix:** Wrap action buttons with loading-dependent disabled state in `<ClientOnly>` with matching SSR placeholder, **OR** ensure `isLoading` starts consistently on both sides by initializing the status to `'idle'` rather than `'pending'`.

## Case 2: Analytics — USelectMenu class mismatch

- **Route:** `/analytics`
- **Warning:** `Hydration class mismatch`
- **SSR:** `class="truncate text-dimmed"`
- **CSR:** `class="truncate pointer-events-none"`
- **Component Stack:** `ComboboxTrigger → USelectMenu`
- **Bucket:** D — Third-party component (Radix/Reka combobox) not fully SSR-deterministic
- **Root Cause:** The Radix ComboboxTrigger renders different CSS classes based on internal open/closed state that initializes differently on server vs client.
- **Fix:** Wrap the `USelectMenu` in `<ClientOnly>` with a matching static placeholder skeleton. This is the recommended approach for combobox/popover SSR quirks.

## Case 3: Analytics — Chart title text mismatch

- **Route:** `/analytics`
- **Warning:** `Hydration text content mismatch`
- **SSR Text:** `Metrics Trend for ...`
- **CSR Text:** `Metrics Trend for austin-texas-net`
- **Component Stack:** `AnalyticsCombinedChart → Analytics`
- **Bucket:** F — Async data timing
- **Root Cause:** `selectedAppName` is initialized as `ref('')` and set via `watch(fleetApps, ..., { immediate: true })`. During SSR, `fleetApps` is fetched but `selectedAppName` remains empty at template render time. On client, the watch fires immediately during hydration and sets the value before the DOM reconciles.
- **Fix:** Initialize `selectedAppName` deterministically from `fleetApps` during setup using a computed default, or use `useAsyncData` to resolve the initial app name server-side.

## Case 4: Fleet — "NaNd ago" in IndexNow column (rendering bug)

- **Route:** `/fleet`
- **Bucket:** A — Non-deterministic values during SSR
- **Root Cause:** `new Date().getTime()` in render function (line 76 of fleet/index.vue) produces different values on SSR vs CSR. Additionally, `indexnowLastSubmission` may be null/undefined but passes the truthiness check because the property exists as an empty or invalid string.
- **Fix:** Move date diff calculation to a helper, handle null/invalid dates explicitly, and wrap the IndexNow cell in `<ClientOnly>` since it depends on `Date.now()`.

## Case 5: Fleet — Literal `indexnow_last_submitted_count URLs` text

- **Route:** `/fleet`
- **Root Cause:** Line 85: `status.indexnowLastSubmittedCount` is `0` or `undefined` (falsy), so the conditional renders `null`. But the rendered text `indexnow_last_submitted_count URLs` suggests the property name itself is being stringified — likely because the status object is returning raw snake_case column names from D1 instead of camelCase.
- **Fix:** Check the D1-to-JS mapping. Either add column aliasing in the query, or access `status.indexnow_last_submitted_count` (snake_case).
