/**
 * Injects build metadata into the document head (SSR + client) so the active
 * deployment can be verified from page source, devtools, or curl.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public
  const appVersion = config.appVersion || ''
  const buildVersion = config.buildVersion || appVersion || ''
  const buildTime = config.buildTime || ''
  const buildTimeLocal = (() => {
    if (!import.meta.client || !buildTime) return ''

    const date = new Date(buildTime)
    if (Number.isNaN(date.getTime())) return buildTime

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZoneName: 'short',
    }).format(date)
  })()

  // `useHead()` needs the Vue app's provide/inject context, not only Nuxt's async context.
  nuxtApp.vueApp.runWithContext(() => {
    useHead({
      meta: [
        { name: 'app-version', content: appVersion },
        { name: 'build-version', content: buildVersion },
        { name: 'build-time', content: buildTime },
        ...(buildTimeLocal ? [{ name: 'build-time-local', content: buildTimeLocal }] : []),
      ],
    })
  })
})
