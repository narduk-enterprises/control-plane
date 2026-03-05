export default defineNuxtPlugin(() => {
  const { appVersion, buildDate, appName } = useRuntimeConfig().public

  console.log(
    `%c${appName} v${appVersion}%c — built ${buildDate}`,
    'font-weight:bold; color:#06b6d4',
    'color:#94a3b8',
  )
})
