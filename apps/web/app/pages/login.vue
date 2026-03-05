<script setup lang="ts">
definePageMeta({
  layout: false,
})

useSeo({
  robots: 'noindex',
  title: 'Login',
  description: 'Control Plane administrative login',
})

useWebPageSchema({
  name: 'Narduk Control Plane — Login',
  description: 'Administrative login portal',
})

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const authApi = useAuthApi()

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authApi.login({ email: email.value, password: password.value })
    await navigateTo('/')
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string }
    error.value = err.data?.message || err.statusMessage || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center bg-default px-4">
      <div class="w-full max-w-sm space-y-6">
        <div class="text-center space-y-2">
          <UIcon name="i-lucide-shield-check" class="size-12 text-primary mx-auto" />
          <h1 class="text-2xl font-bold text-default">Control Plane</h1>
          <p class="text-sm text-muted">Sign in to access fleet management</p>
        </div>

        <UCard>
          <UForm :state="{ email, password }" class="space-y-4" @submit="handleLogin">
            <UFormField label="Email">
              <UInput
                v-model="email"
                type="email"
                placeholder="admin@control-plane.nard.uk"
                icon="i-lucide-mail"
                required
                autofocus
                size="lg"
              />
            </UFormField>

            <UFormField label="Password">
              <UInput
                v-model="password"
                type="password"
                placeholder="••••••••"
                icon="i-lucide-lock"
                required
                size="lg"
              />
            </UFormField>

            <div v-if="error" class="rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">
              {{ error }}
            </div>

            <UButton
              type="submit"
              label="Sign in"
              icon="i-lucide-log-in"
              block
              size="lg"
              :loading="loading"
              class="cursor-pointer"
            />
          </UForm>
        </UCard>
      </div>
    </div>
  </UApp>
</template>
