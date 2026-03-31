// deploy-trigger: 2026-03-04T20:40:25Z
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localNuxtPort = Number(process.env.NUXT_PORT || 3000)
const localSiteUrl = `http://127.0.0.1:${Number.isFinite(localNuxtPort) ? localNuxtPort : 3000}`
/** `import.meta.dev` is not reliable in nuxt.config (Nuxt evaluates config outside the app graph). */
const isNuxtDev = process.env.NODE_ENV === 'development'

const appBackendPreset =
  process.env.APP_BACKEND_PRESET === 'managed-supabase' ? 'managed-supabase' : 'default'
const configuredAuthBackend = process.env.AUTH_BACKEND
const supabaseUrl = process.env.AUTH_AUTHORITY_URL || process.env.SUPABASE_URL || ''
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_AUTH_ANON_KEY ||
  ''
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || ''
const authBackend =
  configuredAuthBackend === 'supabase' || configuredAuthBackend === 'local'
    ? configuredAuthBackend
    : supabaseUrl && supabasePublishableKey
      ? 'supabase'
      : 'local'
const authAuthorityUrl = supabaseUrl
const appOrmTablesEntry =
  process.env.NUXT_DATABASE_BACKEND === 'postgres'
    ? './server/database/pg-app-schema.ts'
    : './server/database/app-schema.ts'

function parseAuthProviders(value: string | undefined) {
  return (value || 'apple,email')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider, index, providers) => provider && providers.indexOf(provider) === index)
}

const authProviders =
  authBackend === 'supabase' ? parseAuthProviders(process.env.AUTH_PROVIDERS) : ['email']
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

  alias: {
    '#server/app-orm-tables': fileURLToPath(new URL(appOrmTablesEntry, import.meta.url)),
  },

  // Disable SSR — this is an auth-gated admin dashboard with zero public pages.
  // SSR was the primary cause of "Worker exceeded resource limits" (Error 1102)
  // because cold-start SSR had to parse 7.9 MB of server bundles (including
  // 3.3 MB wasm for OG images) and render Vue components on every first request.
  ssr: false,

  // OG image generation requires SSR — disable to prevent typecheck errors
  // (defineOgImage auto-import is not registered when SSR is off).
  ogImage: { enabled: false },

  // nitro-cloudflare-dev proxies D1 bindings to the local dev server
  modules: ['@pinia/nuxt', 'nitro-cloudflare-dev'],

  nitro: {
    cloudflareDev: {
      configPath: resolve(__dirname, 'wrangler.json'),
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: Number.isFinite(localNuxtPort) ? localNuxtPort : 3000,
  },

  runtimeConfig: {
    appBackendPreset,
    authBackend,
    authAuthorityUrl,
    authAnonKey: supabasePublishableKey,
    authServiceRoleKey: supabaseServiceRoleKey,
    authStorageKey: process.env.AUTH_STORAGE_KEY || 'web-auth',
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
    supabaseUrl,
    supabasePublishableKey,
    supabaseServiceRoleKey,
    session: {
      password:
        process.env.NUXT_SESSION_PASSWORD ||
        (isNuxtDev ? 'control-plane-dev-session-secret-min-32-chars' : ''),
      // Omit `cookie` here: layer uses `$development` for non-Secure cookies on `nuxt dev`.
    },
    cronSecret: process.env.CRON_SECRET || '',
    githubToken: process.env.GITHUB_TOKEN || '',
    googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || '',
    posthogApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
    posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
    posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    posthogInternalUsersCohortId: process.env.POSTHOG_INTERNAL_USERS_COHORT_ID || '225374',
    gaPropertyId: process.env.GA_PROPERTY_ID || '',
    gaAccountId: process.env.GA_ACCOUNT_ID || '',
    provisionApiKey: process.env.PROVISION_API_KEY || '',
    controlPlaneGhServiceToken: process.env.CONTROL_PLANE_GH_SERVICE_TOKEN || '',
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    dopplerApiToken: process.env.DOPPLER_API_TOKEN || '',
    gscUserEmail: process.env.GSC_USER_EMAIL || '',
    public: {
      appUrl: process.env.SITE_URL || localSiteUrl,
      appName: process.env.APP_NAME || 'Narduk Control Plane',
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      gaPropertyId: process.env.GA_PROPERTY_ID || '',
      posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
      indexNowKey: process.env.INDEXNOW_KEY || '',
    },
  },

  site: {
    url: process.env.SITE_URL || localSiteUrl,
    name: 'Narduk Control Plane',
    description:
      'Fleet dashboard for narduk-enterprises apps — GSC, PostHog, IndexNow, Google Indexing.',
    defaultLocale: 'en',
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Narduk Control Plane',
      url: process.env.SITE_URL || localSiteUrl,
      logo: '/favicon.svg',
    },
  },

  image: {
    cloudflare: {
      baseURL: process.env.SITE_URL || localSiteUrl,
    },
  },
})
