# SSR-Safe Component Patterns

This document codifies the patterns used in this codebase to prevent hydration mismatches. Follow these rules when adding new components or modifying existing ones.

## Core Principle

**SSR and CSR must render the same DOM for the initial paint.** Hydration warnings are not cosmetic — they indicate real divergence that can cause flickering, broken interactivity, or invisible bugs.

---

## Pattern 1: `<ClientOnly>` for Non-deterministic Values

When a value depends on the current time, random generation, or browser-only state, wrap the **smallest possible fragment** in `<ClientOnly>` with a matching fallback.

```vue
<!-- ✅ Correct: only the non-deterministic fragment is client-only -->
<p>
  Last updated:
  <ClientOnly>
    <NuxtTime :datetime="lastUpdated" relative />
  </ClientOnly>
</p>

<!-- ❌ Wrong: wrapping the entire section -->
<ClientOnly>
  <div class="status-section">
    <p>Last updated: <NuxtTime :datetime="lastUpdated" relative /></p>
    <p>Other stable content that should SSR</p>
  </div>
</ClientOnly>
```

**When to use:**

- `Date.now()`, `new Date()` in render/computed
- `Math.random()`, `nanoid()` in templates
- `NuxtTime` with `relative` prop
- Any value that changes between server render and client hydration

---

## Pattern 2: Deterministic Initialization with `useState` / `ref`

When data is available at SSR time, initialize refs synchronously from it — don't rely on watchers to set initial values.

```typescript
// ✅ Correct: initialize from SSR data synchronously
const { apps } = useFleet();
const selectedApp = ref(apps.value[0]?.name ?? '');

// ❌ Wrong: initialize empty and set via watch
const selectedApp = ref('');
watch(
  apps,
  (newApps) => {
    if (newApps.length && !selectedApp.value) {
      selectedApp.value = newApps[0].name;
    }
  },
  { immediate: true }
);
```

---

## Pattern 3: `<ClientOnly>` for Third-party SSR-unsafe Components

Some UI components (comboboxes, popovers, chart libraries) render different internal classes on server vs client. Wrap them in `<ClientOnly>` with a dimensionally-matching skeleton.

```vue
<ClientOnly>
  <USelectMenu v-model="value" :items="items" class="w-48" />
  <template #fallback>
    <div class="w-48 h-9 rounded-md border border-default bg-white animate-pulse" />
  </template>
</ClientOnly>
```

**Known SSR-unsafe in this codebase:**

- `USelectMenu` (Radix ComboboxTrigger class mismatch)
- Any chart/graph component

---

## Pattern 4: Client-only Fetch Status Gates

When `useFetch` uses `server: false`, its status is `'idle'` during SSR but `'pending'` on client. Any UI that depends on this status (`:loading`, `:disabled`) will mismatch.

```vue
<!-- ✅ Correct: wrap loading-dependent buttons in ClientOnly -->
<ClientOnly>
  <UButton :loading="isLoading" @click="refresh">Refresh</UButton>
</ClientOnly>

<!-- ❌ Wrong: binding loading state from server:false fetch to SSR-rendered button -->
<UButton :loading="isLoading" @click="refresh">Refresh</UButton>
```

---

## Pattern 5: Guard with `import.meta.client`

For browser-only API access (window, document, localStorage), guard with `import.meta.client` or move into `onMounted`.

```typescript
// ✅ Correct
onMounted(() => {
  const width = window.innerWidth;
});

// ✅ Also correct
if (import.meta.client) {
  const stored = localStorage.getItem('key');
}

// ❌ Wrong: accessing in setup without guard
const width = window.innerWidth; // crashes on SSR
```

---

## Inline Comment Convention

Every hydration fix must include a comment explaining why:

```vue
<!-- hydration: relative time differs SSR vs CSR -->
<!-- hydration: USelectMenu Radix ComboboxTrigger renders different classes SSR vs CSR -->
<!-- hydration: loading/disabled depends on client-only fetch status -->
```

```typescript
// hydration: initialize synchronously from SSR data (SSR/CSR must match)
```
