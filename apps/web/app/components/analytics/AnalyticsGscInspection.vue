<script setup lang="ts">
import type { GscInspection } from '~/types/analytics'

const props = defineProps<{
  inspection: GscInspection
}>()

const inspectionRef = computed(() => props.inspection)
const {
  formattedLastCrawlTime,
  formattedCrawledAs,
  coverageState,
  indexingState,
  pageFetchState,
  robotsTxtState,
  sitemap,
  googleCanonical,
  userCanonical,
  inspectionLink,
  isPass,
} = useGscInspection(inspectionRef)
</script>

<template>
  <UCard class="overflow-hidden">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon
          :name="isPass ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
          :class="isPass ? 'text-success' : 'text-warning'"
          class="size-5"
        />
        <h3 class="text-sm font-medium text-default">URL Inspection</h3>
        <UBadge :color="isPass ? 'success' : 'warning'" variant="soft" size="sm">
          {{ isPass ? 'Indexed' : 'Needs attention' }}
        </UBadge>
      </div>
    </template>
    <p class="text-sm text-muted">{{ coverageState }}</p>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl border border-default bg-elevated/20 p-3">
        <p class="text-[11px] uppercase tracking-[0.16em] text-muted">Indexing</p>
        <p class="mt-1 text-sm font-medium text-default">{{ indexingState || 'Unknown' }}</p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/20 p-3">
        <p class="text-[11px] uppercase tracking-[0.16em] text-muted">Fetch State</p>
        <p class="mt-1 text-sm font-medium text-default">{{ pageFetchState || 'Unknown' }}</p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/20 p-3">
        <p class="text-[11px] uppercase tracking-[0.16em] text-muted">Robots</p>
        <p class="mt-1 text-sm font-medium text-default">{{ robotsTxtState || 'Unknown' }}</p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/20 p-3">
        <p class="text-[11px] uppercase tracking-[0.16em] text-muted">Canonical</p>
        <p class="mt-1 text-sm font-medium text-default break-all">
          {{ googleCanonical || userCanonical || 'Not reported' }}
        </p>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-4 text-xs text-muted">
      <span v-if="formattedLastCrawlTime">Last crawled: {{ formattedLastCrawlTime }}</span>
      <span v-if="formattedCrawledAs">Agent: {{ formattedCrawledAs }}</span>
    </div>

    <div v-if="sitemap.length" class="mt-3 space-y-1 text-xs text-muted">
      <p class="font-medium text-default">Sitemaps</p>
      <p v-for="entry in sitemap" :key="entry" class="break-all">{{ entry }}</p>
    </div>

    <UButton
      v-if="inspectionLink"
      :to="inspectionLink"
      target="_blank"
      variant="outline"
      size="sm"
      class="mt-3 cursor-pointer"
      icon="i-lucide-external-link"
    >
      View in GSC
    </UButton>
  </UCard>
</template>
