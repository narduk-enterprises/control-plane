<script setup lang="ts">
const route = useRoute()

useSeo({
  title: `Search Redirect — ${String(route.params.app ?? '')}`,
  description: 'Redirecting to the canonical Search Console section.',
})
useWebPageSchema({
  name: 'Search Redirect',
  description: 'Redirects legacy search routes into the canonical analytics snapshot.',
})

await navigateTo(
  {
    path: `/analytics/${String(route.params.app ?? '')}`,
    hash: '#search-console',
    query: route.query,
  },
  { replace: true },
)
</script>

<template>
  <div class="py-12 text-center text-sm text-muted">Redirecting to Search Console snapshot…</div>
</template>
