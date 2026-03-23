export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public
  const localBuildTime = (() => {
    if (!config.buildTime) return 'unknown'

    const date = new Date(config.buildTime)
    if (Number.isNaN(date.getTime())) return config.buildTime

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZoneName: 'short',
    }).format(date)
  })()
  const payload = {
    appName: config.appName || 'Unknown App',
    appVersion: config.appVersion || 'unknown',
    buildVersion: config.buildVersion || config.appVersion || 'unknown',
    buildTime: config.buildTime || 'unknown',
    localBuildTime,
  }

  const marker = `${payload.appVersion}:${payload.buildVersion}:${payload.buildTime}`
  if (window.__NARDUK_BUILD_LOGGED__ === marker) return

  window.__NARDUK_BUILD__ = payload
  window.__NARDUK_BUILD_LOGGED__ = marker

  console.info(
    `[build] ${payload.appName} v${payload.appVersion} · ${payload.buildVersion} · deployed ${payload.localBuildTime}`,
  )
})
