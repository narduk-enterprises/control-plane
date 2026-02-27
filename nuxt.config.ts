// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Point to the new local Layer until GitHub is pushed
  extends: ['../narduk-nuxt-layer'],

  runtimeConfig: {
    // Server-only (admin API routes)
    googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || '',
    posthogApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
    gaPropertyId: process.env.GA_PROPERTY_ID || '',
    posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
    public: {
      appUrl: process.env.SITE_URL || 'https://nuxt-v4-template.workers.dev',
      appName: process.env.APP_NAME || 'Nuxt 4 Demo',
      // Analytics
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
      // IndexNow
      indexNowKey: process.env.INDEXNOW_KEY || '',
    }
  },

  site: {
    url: process.env.SITE_URL || 'https://nuxt-v4-template.workers.dev',
    name: 'Nuxt 4 Demo',
    description: 'A production-ready demo template showcasing Nuxt 4, Nuxt UI 4, Tailwind CSS 4, and Cloudflare Workers with D1 database.',
    defaultLocale: 'en',
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Nuxt 4 Demo',
      url: process.env.SITE_URL || 'https://nuxt-v4-template.workers.dev',
      logo: '/favicon.svg',
    },
  },

  image: {
    provider: 'cloudflare',
    cloudflare: {
      baseURL: process.env.SITE_URL || 'https://nuxt-v4-template.workers.dev',
    },
  },

  nitro: {
    preset: 'cloudflare-module',
    esbuild: {
      options: {
        target: 'esnext'
      }
    },
    externals: {
      inline: ['drizzle-orm']
    },
    rollupConfig: {
      plugins: [
        {
          name: 'fix-og-image-mock',
          resolveId(id: string) {
            if (id.includes('nuxt-og-image') && id.includes('proxy-cjs')) {
              // Now provided by the layer, fallback to require.resolve
              try {
                return { id: require.resolve('nuxt-og-image/dist/runtime/mock/proxy-cjs.js'), external: false }
              } catch {
                return { id: '../narduk-nuxt-layer/node_modules/nuxt-og-image/dist/runtime/mock/proxy-cjs.js', external: false }
              }
            }
          },
        },
      ],
    },
  },
})
