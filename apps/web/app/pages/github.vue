<script setup lang="ts">
import type { TableColumn } from '~/types/table'
import type { GithubRepo } from '~/composables/useGithubRepos'

useSeo({
  title: 'GitHub Repositories',
  description: 'Recent GitHub repositories and CI/CD build statuses.',
})

useWebPageSchema({
  name: 'Narduk Control Plane — GitHub Repositories',
  description: 'Recent GitHub repositories and CI/CD build statuses.',
})

const { data: repos, status, error, forceRefresh } = useGithubRepos()

const isLoading = computed(() => status.value === 'pending')

function getStatusIcon(repo: GithubRepo) {
  if (!repo.latestRun) return { name: 'i-lucide-minus', class: 'text-muted' }
  const { conclusion, status } = repo.latestRun
  if (status !== 'completed')
    return { name: 'i-lucide-loader-2', class: 'text-primary animate-spin' }
  if (conclusion === 'success') return { name: 'i-lucide-check-circle', class: 'text-success' }
  if (conclusion === 'failure') return { name: 'i-lucide-x-circle', class: 'text-error' }
  return { name: 'i-lucide-help-circle', class: 'text-muted' }
}

const UIcon = resolveComponent('UIcon')
const NuxtLink = resolveComponent('NuxtLink')
const UBadge = resolveComponent('UBadge')
const NuxtTime = resolveComponent('NuxtTime')
const UButton = resolveComponent('UButton')

const githubColumns: TableColumn<GithubRepo>[] = [
  {
    accessorKey: 'name',
    header: 'Repository',
    cell: ({ row }) => {
      const repo = row.original
      const privateIcon = h(UIcon, {
        name: repo.private ? 'i-lucide-lock' : 'i-lucide-book-open',
        class: 'size-4 shrink-0 text-muted',
      })
      const titleLink = h(
        NuxtLink,
        {
          to: repo.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class:
            'font-semibold text-default hover:text-primary transition-colors flex items-center gap-2 truncate',
        },
        () => [privateIcon, h('span', { class: 'truncate' }, repo.name)],
      )

      const desc = h(
        'p',
        { class: 'text-xs text-muted mt-1 line-clamp-1 max-w-sm' },
        repo.description || 'No description provided.',
      )

      return h('div', { class: 'flex flex-col gap-1 min-w-0' }, [titleLink, desc])
    },
  },
  {
    accessorKey: 'language',
    header: 'Language',
    meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell w-32' } },
    cell: ({ row }) => {
      const lang = row.original.language
      if (!lang) return h('span', { class: 'text-muted text-xs' }, '-')
      return h(UBadge, { color: 'neutral', variant: 'soft', size: 'sm' }, () => lang)
    },
  },
  {
    accessorKey: 'stars',
    header: 'Stars',
    meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell tabular-nums w-24' } },
    cell: ({ row }) => {
      const stars = row.original.stars
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h(UIcon, { name: 'i-lucide-star', class: 'size-4 text-muted shrink-0' }),
        h('span', { class: 'text-sm text-muted' }, stars?.toString() || '0'),
      ])
    },
  },
  {
    accessorKey: 'forks',
    header: 'Forks',
    meta: { class: { th: 'hidden lg:table-cell', td: 'hidden lg:table-cell tabular-nums w-24' } },
    cell: ({ row }) => {
      const forks = row.original.forks
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h(UIcon, { name: 'i-lucide-git-fork', class: 'size-4 text-muted shrink-0' }),
        h('span', { class: 'text-sm text-muted' }, forks?.toString() || '0'),
      ])
    },
  },
  {
    id: 'status',
    header: 'Latest Run',
    enableSorting: false,
    cell: ({ row }) => {
      const repo = row.original
      if (!repo.latestRun) {
        return h('div', { class: 'flex items-center gap-2' }, [
          h(UIcon, { name: 'i-lucide-minus', class: 'size-4 text-muted shrink-0' }),
          h('span', { class: 'text-xs text-muted' }, 'No recent runs'),
        ])
      }

      const iconAttrs = getStatusIcon(repo)
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UIcon, { ...iconAttrs, class: [iconAttrs.class, 'size-4 shrink-0'] }),
        h(
          NuxtLink,
          {
            to: repo.latestRun.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            class:
              'text-xs font-medium text-default hover:text-primary transition-colors truncate max-w-[140px]',
          },
          () => repo.latestRun!.name,
        ),
      ])
    },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    meta: {
      class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell tabular-nums text-xs w-32' },
    },
    cell: ({ row }) =>
      h('ClientOnly', null, () =>
        h(NuxtTime, { datetime: row.original.updatedAt, relative: true }),
      ),
  },
  {
    id: 'actions',
    header: '',
    meta: { class: { th: 'text-right', td: 'text-right' } },
    enableSorting: false,
    cell: ({ row }) => {
      const repo = row.original
      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(UButton, {
          to: `${repo.url}/actions`,
          target: '_blank',
          rel: 'noopener noreferrer',
          size: 'xs',
          variant: 'ghost',
          color: 'neutral',
          icon: 'i-lucide-play-circle',
          'aria-label': 'Actions',
          class: 'cursor-pointer',
        }),
        h(UButton, {
          to: repo.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          size: 'xs',
          variant: 'ghost',
          color: 'neutral',
          icon: 'i-lucide-external-link',
          'aria-label': 'Open repo',
          class: 'cursor-pointer',
        }),
      ])
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable expects @nuxt/ui TableColumn, not our local type
const githubColumnsForTable = githubColumns as any

const searchQuery = ref('')
const sortedRepos = computed(() => {
  if (!repos.value) return []
  return [...repos.value].sort((a, b) => a.name.localeCompare(b.name))
})

const filteredRepos = computed(() => {
  const allRepos = sortedRepos.value
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allRepos

  return allRepos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(q) ||
      (repo.description && repo.description.toLowerCase().includes(q)) ||
      (repo.language && repo.language.toLowerCase().includes(q)),
  )
})
</script>

<template>
  <div>
    <AppBreadcrumbs :items="[{ label: 'Dashboard', to: '/' }, { label: 'GitHub Repositories' }]" />

    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">GitHub Repositories</h1>
        <p class="mt-1 text-sm text-muted">All repositories and CI/CD build statuses</p>
      </div>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-refresh-cw"
        class="cursor-pointer shrink-0"
        :loading="isLoading"
        @click="() => forceRefresh()"
      >
        Refresh
      </UButton>
    </div>

    <!-- Error State -->
    <UAlert
      v-if="error"
      title="Error loading repositories"
      :description="
        error.data?.message ||
        error.message ||
        'Failed to fetch GitHub data. Ensure GITHUB_TOKEN is configured.'
      "
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      class="mb-8"
      :actions="[{ label: 'Try again', onClick: () => forceRefresh() }]"
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
    <div
      v-else-if="!repos?.length"
      class="rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-github" class="mx-auto size-12 text-muted mb-4" />
      <h3 class="text-lg font-medium text-default mb-1">No repositories found</h3>
      <p class="text-sm text-muted max-w-sm mx-auto">
        We couldn't find any recently updated repositories. Make sure your GitHub token has the
        correct permissions.
      </p>
    </div>

    <!-- Repos Table -->
    <UCard v-else>
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="font-semibold text-default">Repositories</h2>
          <UInput
            v-model="searchQuery"
            placeholder="Search repositories..."
            class="max-w-xs"
            icon="i-lucide-search"
          />
        </div>
      </template>
      <div v-if="filteredRepos.length" class="overflow-x-auto">
        <UTable :data="filteredRepos" :columns="githubColumnsForTable" />
      </div>
      <div v-else class="rounded-lg border border-dashed border-default p-8 text-center my-4 mx-4">
        <UIcon name="i-lucide-search-x" class="mx-auto size-10 text-muted" />
        <p class="mt-2 text-sm font-medium text-default">No matches</p>
        <p class="mt-1 text-sm text-muted">Try a different search.</p>
      </div>
    </UCard>
  </div>
</template>
