<script setup lang="ts">
import type { AuditResult } from '~/types/audit'

const props = defineProps<{
  apps: AuditResult[]
  defaultExpanded?: boolean
  emptyMessage?: string
}>()

// Track which cards are open; seed from defaultExpanded
const openSet = ref<Set<string>>(new Set(props.defaultExpanded ? props.apps.map((a) => a.app) : []))

watch(
  () => props.apps,
  (apps) => {
    if (props.defaultExpanded) {
      openSet.value = new Set(apps.map((a) => a.app))
    }
  },
  { immediate: false },
)

function toggle(appName: string) {
  const s = new Set(openSet.value)
  if (s.has(appName)) {
    s.delete(appName)
  } else {
    s.add(appName)
  }
  openSet.value = s
}

function isOpen(appName: string) {
  return openSet.value.has(appName)
}

function appStatusSummary(app: AuditResult) {
  if (app.fetchError) return { fail: 1, warning: 0, skipped: 0, pass: 0 }
  return app.checks.reduce(
    (acc, c) => {
      acc[c.status as keyof typeof acc]++
      return acc
    },
    { pass: 0, fail: 0, warning: 0, skipped: 0 },
  )
}

function worstStatus(app: AuditResult): 'fail' | 'warning' | 'skipped' | 'pass' {
  if (app.fetchError) return 'fail'
  const s = appStatusSummary(app)
  if (s.fail > 0) return 'fail'
  if (s.warning > 0) return 'warning'
  if (s.skipped > 0) return 'skipped'
  return 'pass'
}

function statusColor(status: string) {
  if (status === 'pass') return 'text-success'
  if (status === 'fail') return 'text-error'
  if (status === 'warning') return 'text-warning'
  return 'text-muted'
}
function statusIcon(status: string) {
  if (status === 'pass') return 'i-lucide-circle-check'
  if (status === 'fail') return 'i-lucide-circle-x'
  if (status === 'warning') return 'i-lucide-triangle-alert'
  return 'i-lucide-circle-minus'
}
function statusBadgeColor(status: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (status === 'pass') return 'success'
  if (status === 'fail') return 'error'
  if (status === 'warning') return 'warning'
  return 'neutral'
}

function chevronIcon(appName: string) {
  return openSet.value.has(appName) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
}

// Pre-compute per-app summary so the template uses simple map lookups
// (avoids vue-official/no-template-complex-expressions warnings)
const summaryMap = computed(() => {
  const m = new Map<
    string,
    {
      pass: number
      fail: number
      warning: number
      skipped: number
      allPass: boolean
      icon: string
      colorClass: string
    }
  >()
  for (const app of props.apps) {
    const s = appStatusSummary(app)
    const worst = worstStatus(app)
    m.set(app.app, {
      ...s,
      allPass: !app.fetchError && s.pass === app.checks.length,
      icon: statusIcon(worst),
      colorClass: statusColor(worst),
    })
  }
  return m
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="apps.length === 0" class="py-8 text-center text-sm text-muted">
      {{ emptyMessage ?? 'No apps to display.' }}
    </p>

    <UCard v-for="app in apps" :key="app.app" class="overflow-hidden">
      <!-- Card header — always visible, click to toggle -->
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        class="w-full cursor-pointer px-0 py-0 hover:bg-transparent"
        @click="toggle(app.app)"
      >
        <div class="flex w-full items-center justify-between gap-3 text-left">
          <!-- Worst-status dot -->
          <UIcon
            :name="summaryMap.get(app.app)!.icon"
            :class="`size-5 shrink-0 ${summaryMap.get(app.app)!.colorClass}`"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold text-default">
              {{ app.app }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ app.url }}
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <!-- Status count badges -->
          <template v-if="!app.fetchError">
            <UBadge
              v-if="summaryMap.get(app.app)!.fail > 0"
              color="error"
              variant="subtle"
              size="xs"
            >
              {{ summaryMap.get(app.app)!.fail }} fail
            </UBadge>
            <UBadge
              v-if="summaryMap.get(app.app)!.warning > 0"
              color="warning"
              variant="subtle"
              size="xs"
            >
              {{ summaryMap.get(app.app)!.warning }} warn
            </UBadge>
            <UBadge
              v-if="summaryMap.get(app.app)!.skipped > 0"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              {{ summaryMap.get(app.app)!.skipped }} skip
            </UBadge>
            <UBadge
              v-if="summaryMap.get(app.app)!.allPass"
              color="success"
              variant="subtle"
              size="xs"
            >
              all pass
            </UBadge>
          </template>
          <UBadge v-else color="error" variant="subtle" size="xs"> fetch error </UBadge>

          <UIcon
            :name="chevronIcon(app.app)"
            class="size-4 text-muted transition-transform duration-150"
          />
        </div>
      </UButton>

      <!-- Expanded check list -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-[800px]"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 max-h-[800px]"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="isOpen(app.app)" class="mt-3 overflow-hidden border-t border-default pt-3">
          <!-- Fetch error -->
          <div
            v-if="app.fetchError"
            class="flex items-start gap-2 rounded-md bg-error/10 px-3 py-2 text-sm text-error"
          >
            <UIcon name="i-lucide-wifi-off" class="mt-0.5 size-4 shrink-0" />
            <span>{{ app.fetchError }}</span>
          </div>

          <!-- Checks -->
          <div v-else class="flex flex-col divide-y divide-default">
            <div
              v-for="check in app.checks"
              :key="check.name"
              class="flex items-start gap-3 py-2.5"
            >
              <UIcon
                :name="statusIcon(check.status)"
                :class="`mt-0.5 size-4 shrink-0 ${statusColor(check.status)}`"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-default">{{ check.name }}</span>
                  <UBadge :color="statusBadgeColor(check.status)" variant="subtle" size="xs">
                    {{ check.status }}
                  </UBadge>
                </div>
                <p class="mt-0.5 text-xs text-muted">
                  {{ check.message }}
                </p>
                <div
                  v-if="check.expected || check.actual"
                  class="mt-1 flex flex-wrap gap-4 text-xs"
                >
                  <span v-if="check.expected" class="text-muted">
                    <span class="text-default/60">expected:</span>
                    <code class="ml-1 font-mono">{{ check.expected }}</code>
                  </span>
                  <span v-if="check.actual" class="text-muted">
                    <span class="text-default/60">actual:</span>
                    <code class="ml-1 font-mono">{{ check.actual }}</code>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </UCard>
  </div>
</template>
