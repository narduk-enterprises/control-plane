import type { H3Event } from 'h3'

export function assertProvisionApiKey(
  event: H3Event,
  message = 'Unauthorized',
): void {
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'authorization')
  const providedKey = authHeader?.replace('Bearer ', '')

  if (!config.provisionApiKey || providedKey !== config.provisionApiKey) {
    throw createError({ statusCode: 401, message })
  }
}
