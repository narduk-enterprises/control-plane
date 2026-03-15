<script setup lang="ts">
const props = defineProps<{
  appName: string
}>()

const {
  data: sitemapData,
  error: sitemapError,
  loading: sitemapLoading,
  run: runSitemapAnalysis,
} = useFleetSitemapAnalysis(() => props.appName)

const sitemapUrlsPreview = computed(() => (sitemapData.value?.urls ?? []).slice(0, 50))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-map" class="text-primary size-5" />
          <h3 class="text-sm font-medium text-default">Sitemap Analysis</h3>
        </div>
        <div class="flex gap-2">
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            :loading="sitemapLoading"
            class="cursor-pointer"
            icon="i-lucide-file-search"
            @click="runSitemapAnalysis(false)"
          >
            Run
          </UButton>
          <UButton
            size="xs"
            variant="outline"
            color="primary"
            :loading="sitemapLoading"
            class="cursor-pointer"
            icon="i-lucide-scan-search"
            @click="runSitemapAnalysis(true)"
          >
            Deep
          </UButton>
        </div>
      </div>
    </template>

    <p class="text-sm text-muted">
      Fetch sitemap.xml and list all URLs. Deep analysis runs HEAD requests (up to 200) for status
      and response time.
    </p>

    <div
      v-if="sitemapError"
      class="mt-3 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error"
    >
      {{ sitemapError.message }}
    </div>

    <div v-else-if="sitemapData" class="mt-4 space-y-4">
      <div class="flex flex-wrap gap-4 text-sm">
        <span class="font-medium text-default">Sitemap:</span>
        <ULink
          :to="sitemapData.sitemapUrl"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline truncate"
        >
          {{ sitemapData.sitemapUrl }}
        </ULink>
      </div>
      <div class="flex flex-wrap gap-4 sm:gap-6 text-sm">
        <span>
          <strong class="text-default">{{ sitemapData.totalUrls }}</strong>
          <span class="text-muted"> URLs</span>
        </span>
        <template v-if="sitemapData.deepSummary">
          <span>
            <strong class="text-success">{{ sitemapData.deepSummary.ok }}</strong>
            <span class="text-muted"> OK</span>
          </span>
          <span>
            <strong class="text-error">{{ sitemapData.deepSummary.error }}</strong>
            <span class="text-muted"> errors</span>
          </span>
          <span v-if="sitemapData.deepSummary.timeout > 0">
            <strong class="text-warning">{{ sitemapData.deepSummary.timeout }}</strong>
            <span class="text-muted"> timeouts</span>
          </span>
          <span>
            <span class="text-muted">Avg </span>
            <strong class="text-default">{{ sitemapData.deepSummary.avgDurationMs }} ms</strong>
          </span>
        </template>
      </div>

      <div
        v-if="sitemapData.entries?.length"
        class="max-h-80 overflow-auto rounded-lg border border-default -mx-4 sm:mx-0"
      >
        <UTable
          :data="sitemapData.entries"
          :columns="[
            {
              accessorKey: 'url',
              header: 'URL',
              meta: { class: { td: 'max-w-[240px] sm:max-w-[320px] truncate font-mono text-xs' } },
              cell: ({ row }: any) => row.original.url,
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }: any) => row.original.status || '—',
            },
            {
              accessorKey: 'durationMs',
              header: 'Time',
              cell: ({ row }: any) => row.original.durationMs,
            },
          ]"
          class="text-xs"
        />
      </div>

      <div
        v-else-if="sitemapData.urls?.length"
        class="max-h-48 overflow-auto rounded-lg border border-default p-2"
      >
        <ul class="list-inside list-disc space-y-1 font-mono text-xs text-muted">
          <li v-for="u in sitemapUrlsPreview" :key="u" class="truncate">
            <ULink :to="u" target="_blank" rel="noopener" class="text-primary hover:underline">
              {{ u }}
            </ULink>
          </li>
        </ul>
        <p v-if="sitemapData.urls.length > 50" class="mt-2 text-xs text-muted">
          + {{ sitemapData.urls.length - 50 }} more URLs
        </p>
      </div>
    </div>
  </UCard>
</template>
