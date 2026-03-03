/**
 * Injects build version and build time into the document head as meta tags (SSR + client)
 * so scripts (e.g. curl or CI) can check if a deployment is on the latest build.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public
  const buildVersion = config.buildVersion || ''
  const buildTime = config.buildTime || ''
  useHead({
    meta: [
      { name: 'build-version', content: buildVersion },
      { name: 'build-time', content: buildTime },
    ],
  })
})
