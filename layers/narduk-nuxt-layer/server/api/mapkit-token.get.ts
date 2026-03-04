/**
 * GET /api/mapkit-token
 *
 * Returns a MapKit JS JWT for the request's origin (Origin or Referer header).
 * Use this so the client can get a token in authorizationCallback without
 * setting MAPKIT_TOKEN in env. Works for localhost and any configured domain.
 *
 * Requires: APPLE_SECRET_KEY, APPLE_TEAM_ID, APPLE_KEY_ID (same as Server API).
 * In Apple Developer: create a Maps identifier and a key with MapKit JS enabled.
 */
import type { H3Event } from 'h3'
import { getHeader } from 'h3'

function getOriginFromRequest(event: H3Event): string {
  const origin = getHeader(event, 'origin')
  if (origin) return origin

  const referer = getHeader(event, 'referer')
  if (referer) {
    try {
      const u = new URL(referer)
      return u.origin
    } catch {
      // ignore
    }
  }

  const config = useRuntimeConfig(event)
  return (config.public as { appUrl?: string }).appUrl || 'http://localhost:3000'
}

export default defineEventHandler(async (event) => {
  const origin = getOriginFromRequest(event)

  try {
    const token = await getMapKitJsToken(event, origin)
    return { token }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate MapKit JS token'
    throw createError({ statusCode: 500, message })
  }
})
