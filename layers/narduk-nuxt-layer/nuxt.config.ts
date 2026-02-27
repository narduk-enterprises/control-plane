export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxt/image',
    '@nuxtjs/seo',
    '@nuxt/eslint',
  ],
  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-15',

  future: {
    compatibilityVersion: 4
  },

  ui: {
    colorMode: true
  },

  colorMode: {
    preference: 'dark'
  },

  ogImage: {
    defaults: {
      component: 'OgImageDefault',
    },
  },
  
  // Expose the layer configurations and files to consumers
  components: [
    { path: '~/components', pathPrefix: false }
  ]
})
