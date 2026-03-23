import { enforceRateLimit } from '#layer/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'auth-logout', 30, 60_000)
  const log = useLogger(event).child('Auth')
  await clearUserSession(event)
  log.info('Session cleared')
  return { success: true }
})
