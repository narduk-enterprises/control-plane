export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public
  const payload = {
    appName: config.appName || 'Unknown App',
    appVersion: config.appVersion || 'unknown',
    buildVersion: config.buildVersion || config.appVersion || 'unknown',
    buildTime: config.buildTime || 'unknown',
  }

  const marker = `${payload.appVersion}:${payload.buildVersion}:${payload.buildTime}`
  if (window.__NARDUK_BUILD_LOGGED__ === marker) return

  window.__NARDUK_BUILD__ = payload
  window.__NARDUK_BUILD_LOGGED__ = marker

  const normalizedBuildTime = (() => {
    if (payload.buildTime === 'unknown') return 'unknown'

    const date = new Date(payload.buildTime)
    if (Number.isNaN(date.getTime())) return payload.buildTime

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZoneName: 'short',
    }).format(date)
  })()

  console.info(
    `[build] ${payload.appName} v${payload.appVersion} · ${payload.buildVersion} · ${normalizedBuildTime}`,
  )
})
