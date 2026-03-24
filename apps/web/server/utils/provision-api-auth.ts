import type { H3Event } from 'h3'

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses byte-level XOR accumulation so execution time is independent
 * of how many characters match.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)

  if (aBytes.length !== bBytes.length) {
    // Still compare to keep timing uniform, but result is always false
    let sink = 0
    for (let i = 0; i < aBytes.length; i++) {
      sink |= aBytes[i]!
    }
    void sink
    return false
  }

  let result = 0
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i]! ^ bBytes[i]!
  }
  return result === 0
}

export function assertProvisionApiKey(event: H3Event, message = 'Unauthorized'): void {
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'authorization')
  const providedKey = authHeader?.replace('Bearer ', '')

  if (
    !config.provisionApiKey ||
    !providedKey ||
    !timingSafeEqual(providedKey, config.provisionApiKey)
  ) {
    throw createError({ statusCode: 401, message })
  }
}
