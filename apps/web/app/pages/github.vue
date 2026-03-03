<script setup lang="ts">

useSeo({
  title: 'GitHub Repositories',
  description: 'Recent GitHub repositories and CI/CD build statuses.',
})

useWebPageSchema({
  name: 'Narduk Control Plane — GitHub Repositories',
  description: 'Recent GitHub repositories and CI/CD build statuses.',
})

const { data: repos, status, error, refresh } = useGithubRepos()

const isLoading = computed(() => status.value === 'pending')

function getStatusIcon(repo: GithubRepo) {
  if (!repo.latestRun) return { name: 'i-lucide-minus', class: 'text-muted' }
  const { conclusion, status } = repo.latestRun
  if (status !== 'completed') return { name: 'i-lucide-loader-2', class: 'text-primary animate-spin' }
  if (conclusion === 'success') return { name: 'i-lucide-check-circle', class: 'text-success' }
  if (conclusion === 'failure') return { name: 'i-lucide-x-circle', class: 'text-error' }
  return { name: 'i-lucide-help-circle', class: 'text-muted' }
}
</script>

<template>
  <div>
    <AppBreadcrumbs :items="[{ label: 'Dashboard', to: '/' }, { label: 'GitHub Repositories' }]" />
    
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">
          GitHub Repositories
        </h1>
        <p class="mt-1 text-sm text-muted">
          Recent repositories and CI/CD build statuses
        </p>
      </div>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-refresh-cw"
        class="cursor-pointer shrink-0"
        :loading="isLoading"
        @click="() => refresh()"
      >
        Refresh
      </UButton>
    </div>

    <!-- Error State -->
    <UAlert
      v-if="error"
      title="Error loading repositories"
      :description="error.data?.message || error.message || 'Failed to fetch GitHub data. Ensure GITHUB_TOKEN is configured.'"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      class="mb-8"
      :actions="[{ label: 'Try again', onClick: () => refresh() }]"
    />

    <!-- Loading State -->
    <div v-else-if="isLoading && !repos?.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="i in 6" :key="i" class="animate-pulse">
        <div class="h-6 w-3/4 bg-elevated rounded mb-2"></div>
        <div class="h-4 w-full bg-elevated rounded mb-4"></div>
        <div class="flex items-center gap-2 mt-4">
          <div class="size-5 rounded-full bg-elevated"></div>
          <div class="h-4 w-1/3 bg-elevated rounded"></div>
        </div>
      </UCard>
    </div>

    <!-- Empty State -->
    <div v-else-if="!repos?.length" class="rounded-xl border border-dashed border-default p-12 text-center">
      <UIcon name="i-lucide-github" class="mx-auto size-12 text-muted mb-4" />
      <h3 class="text-lg font-medium text-default mb-1">No repositories found</h3>
      <p class="text-sm text-muted max-w-sm mx-auto">
        We couldn't find any recently updated repositories. Make sure your GitHub token has the correct permissions.
      </p>
    </div>

    <!-- Repo Grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard
        v-for="repo in repos"
        :key="repo.id"
        class="flex flex-col h-full transition-base hover:shadow-elevated"
      >
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <NuxtLink
                :to="repo.url"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold text-default hover:text-primary transition-colors flex items-center gap-2 truncate"
              >
                <UIcon
                  :name="repo.private ? 'i-lucide-lock' : 'i-lucide-book-open'"
                  class="size-4 shrink-0 text-muted"
                />
                <span class="truncate">{{ repo.name }}</span>
              </NuxtLink>
              <p class="text-xs text-muted mt-1 truncate">{{ repo.fullName }}</p>
            </div>
            <UBadge v-if="repo.language" color="neutral" variant="soft" size="sm">
              {{ repo.language }}
            </UBadge>
          </div>
        </template>

        <p class="text-sm text-muted line-clamp-2 mb-4 flex-1">
          {{ repo.description || 'No description provided.' }}
        </p>

        <template #footer>
          <div class="flex items-center justify-between pt-2">
            <div v-if="repo.latestRun" class="flex items-center gap-2">
              <UIcon
                v-bind="getStatusIcon(repo)"
                class="size-4 shrink-0"
              />
              <NuxtLink
                :to="repo.latestRun.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs font-medium text-default hover:text-primary transition-colors truncate max-w-[140px]"
              >
                {{ repo.latestRun.name }}
              </NuxtLink>
            </div>
            <div v-else class="flex items-center gap-2">
              <UIcon name="i-lucide-minus" class="size-4 text-muted shrink-0" />
              <span class="text-xs text-muted">No recent runs</span>
            </div>

            <span class="text-xs text-muted tabular-nums shrink-0">
              <NuxtTime :datetime="repo.updatedAt" relative />
            </span>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
