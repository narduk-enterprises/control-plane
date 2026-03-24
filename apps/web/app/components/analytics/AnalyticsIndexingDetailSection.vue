<script setup lang="ts">
import type { AnalyticsProviderSnapshot, FleetAnalyticsIndexnowMetrics } from '~/types/analytics'
import { providerStatusColor, providerStatusText } from '~/utils/analyticsPresentation'

const props = defineProps<{
  appName: string
  provider: AnalyticsProviderSnapshot<FleetAnalyticsIndexnowMetrics> | null
}>()

const { loading: indexnowLoading, submit: submitIndexnow } = useFleetIndexnow(() => props.appName)
const { loading: gscSitemapLoading, submit: submitGscSitemap } = useFleetGscSitemap(
  () => props.appName,
)

const metrics = computed(() => props.provider?.metrics)
const providerStatus = computed(() => props.provider?.status ?? 'no_data')
const providerMessage = computed(
  () =>
    props.provider?.message ||
    'IndexNow submission history and sitemap analysis for this app live here.',
)
const lastSubmissionLabel = computed(() => {
  if (!metrics.value?.lastSubmission) return 'Never'
  return new Date(metrics.value.lastSubmission).toLocaleString()
})
const lastBatchLabel = computed(
  () => metrics.value?.lastSubmittedCount?.toLocaleString() ?? 'Unknown',
)
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold text-default">Indexing Operations</h2>
            <UBadge :color="providerStatusColor(providerStatus)" variant="soft" size="sm">
              {{ providerStatusText(providerStatus) }}
            </UBadge>
          </div>
          <p class="text-sm text-muted">{{ providerMessage }}</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            :loading="indexnowLoading"
            icon="i-lucide-send"
            class="cursor-pointer"
            @click="submitIndexnow()"
          >
            IndexNow Submit
          </UButton>
          <UButton
            :loading="gscSitemapLoading"
            variant="outline"
            color="neutral"
            icon="i-lucide-upload-cloud"
            class="cursor-pointer"
            @click="submitGscSitemap(true)"
          >
            GSC sitemap
          </UButton>
        </div>
      </div>

      <div
        v-if="metrics"
        class="mt-4 grid gap-3 rounded-xl border border-default/60 bg-default/40 p-4 sm:grid-cols-3"
      >
        <div>
          <p class="text-[11px] uppercase tracking-[0.12em] text-muted">Last submission</p>
          <p class="mt-1 text-sm font-semibold text-default">{{ lastSubmissionLabel }}</p>
        </div>
        <div>
          <p class="text-[11px] uppercase tracking-[0.12em] text-muted">Total submits</p>
          <p class="mt-1 text-sm font-semibold text-default">
            {{ metrics.totalSubmissions.toLocaleString() }}
          </p>
        </div>
        <div>
          <p class="text-[11px] uppercase tracking-[0.12em] text-muted">Last batch size</p>
          <p class="mt-1 text-sm font-semibold text-default">{{ lastBatchLabel }}</p>
        </div>
      </div>
    </UCard>

    <AnalyticsSitemapPanel :app-name="appName" />
  </div>
</template>
