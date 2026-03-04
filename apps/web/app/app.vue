<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()
const appName = useRuntimeConfig().public.appName || 'Narduk Control Plane'
const currentYear = new Date().getFullYear()

const colorModeIcon = computed(() => {
  if (colorMode.preference === 'system') return 'i-lucide-monitor'
  return colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'
})

function cycleColorMode() {
  const modes = ['system', 'light', 'dark'] as const
  const idx = modes.indexOf(colorMode.preference as typeof modes[number])
  colorMode.preference = modes[(idx + 1) % modes.length]!
}

const navItems = [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Fleet', to: '/fleet', icon: 'i-lucide-grid-3x3' },
  { label: 'Indexing', to: '/indexing', icon: 'i-lucide-search' },
  { label: 'GitHub', to: '/github', icon: 'i-lucide-github' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' },
]

const mobileMenuOpen = ref(false)

watch(route, () => {
  mobileMenuOpen.value = false
})

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <UApp>
    <ULink
      to="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-50 focus:rounded-lg transition-fast"
    >
      Skip to main content
    </ULink>
    <div class="app-shell min-h-screen flex flex-col bg-default">
      <!-- Header: floating bar with spacing -->
      <div role="banner" class="sticky top-4 left-4 right-4 z-50 mx-4 mt-4 rounded-xl border border-default bg-default/95 shadow-elevated backdrop-blur-xl transition-base">
        <div class="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <NuxtLink
            to="/"
            class="flex items-center gap-2.5 rounded-lg py-2 pr-2 transition-colors hover:bg-elevated cursor-pointer"
          >
            <div class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-50">
              <UIcon name="i-lucide-activity" class="size-5" />
            </div>
            <span class="font-display font-semibold text-lg text-default hidden sm:block">{{ appName }}</span>
          </NuxtLink>

          <!-- Desktop nav -->
          <div class="hidden md:flex items-center gap-0.5" role="navigation" aria-label="Main navigation">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer"
              :class="isActive(item.to)
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-elevated hover:text-default'"
            >
              <UIcon :name="item.icon" class="size-4 shrink-0" />
              {{ item.label }}
            </NuxtLink>
          </div>

          <div class="flex items-center gap-1">
            <UButton
              :icon="colorModeIcon"
              variant="ghost"
              color="neutral"
              size="sm"
              aria-label="Toggle color mode"
              class="cursor-pointer"
              @click="cycleColorMode"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              class="md:hidden cursor-pointer"
              aria-label="Toggle menu"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <UIcon :name="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-5" />
            </UButton>
          </div>
        </div>

        <!-- Mobile nav -->
        <Transition name="slide-down">
          <div
            v-if="mobileMenuOpen"
            class="md:hidden border-t border-default px-3 py-3"
            role="navigation"
            aria-label="Mobile menu"
          >
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer"
              :class="isActive(item.to)
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-elevated hover:text-default'"
            >
              <UIcon :name="item.icon" class="size-4" />
              {{ item.label }}
            </NuxtLink>
          </div>
        </Transition>
      </div>

      <!-- Main: account for floating header -->
      <div id="main-content" class="flex-1 pt-6 pb-12" role="main">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <NuxtLayout>
            <NuxtPage />
          </NuxtLayout>
        </div>
      </div>

      <div class="border-t border-default py-4" role="contentinfo">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p class="text-center text-sm text-muted">
            {{ appName }} &middot; Fleet dashboard &middot; {{ currentYear }}
          </p>
        </div>
      </div>
    </div>
  </UApp>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
