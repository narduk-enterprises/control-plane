// deploy-trigger: 2026-03-04T20:40:25Z
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localNuxtPort = Number(process.env.NUXT_PORT || 3000)
const localSiteUrl = `http://127.0.0.1:${Number.isFinite(localNuxtPort) ? localNuxtPort : 3000}`

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

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
    session: {
      password:
        process.env.NUXT_SESSION_PASSWORD ||
        (import.meta.dev ? 'control-plane-dev-session-secret-min-32-chars' : ''),
      cookie: {
        // Secure=true requires HTTPS; disable in dev so localhost HTTP sessions work
        secure: !import.meta.dev,
      },
    },
    cronSecret: process.env.CRON_SECRET || '',
    githubToken: process.env.GITHUB_TOKEN || '',
    googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || '',
    posthogApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
    posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
    posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
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
