// deploy-trigger: 2026-03-04T20:40:25Z
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

  // nitro-cloudflare-dev proxies D1 bindings to the local dev server
  modules: ['nitro-cloudflare-dev'],

  nitro: {
    cloudflareDev: {
      configPath: resolve(__dirname, 'wrangler.json'),
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  runtimeConfig: {
    session: {
      password:
        process.env.NUXT_SESSION_PASSWORD ||
        (import.meta.dev ? 'control-plane-dev-session-secret-min-32-chars' : ''),
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
      appVersion: pkg.version,
      buildDate: new Date().toISOString(),
      appUrl: process.env.SITE_URL || 'https://control-plane.nard.uk',
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
    url: process.env.SITE_URL || 'https://control-plane.nard.uk',
    name: 'Narduk Control Plane',
    description:
      'Fleet dashboard for narduk-enterprises apps — GSC, PostHog, IndexNow, Google Indexing.',
    defaultLocale: 'en',
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Narduk Control Plane',
      url: process.env.SITE_URL || 'https://control-plane.nard.uk',
      logo: '/favicon.svg',
    },
  },

  image: {
    cloudflare: {
      baseURL: process.env.SITE_URL || 'https://control-plane.nard.uk',
    },
  },
})
