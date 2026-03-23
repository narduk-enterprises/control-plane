/**
 * Owner Tag Endpoint
 *
 * Sets or clears the `narduk_owner` cookie used by the PostHog plugin
 * to tag internal/owner traffic. Protected by a shared secret so only
 * the site owner can call it.
 *
 * Usage (once per browser/device):
 *   curl -X POST https://myapp.com/api/owner-tag \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret":"<OWNER_TAG_SECRET>","enabled":true}'
 *
 * To remove the tag:
 *   curl -X POST https://myapp.com/api/owner-tag \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret":"<OWNER_TAG_SECRET>","enabled":false}'
 */
import { z } from 'zod'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

const ownerTagSchema = z.object({
  secret: z.string(),
  enabled: z.boolean().optional().default(true),
})

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'owner-tag', 10, 60_000)
  const config = useRuntimeConfig(event)
  const ownerSecret = config.ownerTagSecret

  if (!ownerSecret) {
    throw createError({
      statusCode: 501,
      message: 'Owner tagging is not configured. Set OWNER_TAG_SECRET in Doppler.',
    })
  }

  const raw = await readBody(event)
  const parsed = ownerTagSchema.safeParse(raw)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body.',
    })
  }

  if (parsed.data.secret !== ownerSecret) {
    throw createError({
      statusCode: 403,
      message: 'Invalid secret.',
    })
  }

  const enabled = parsed.data.enabled
  const cookieName = 'narduk_owner'

  if (enabled) {
    setCookie(event, cookieName, 'true', {
      httpOnly: false, // Must be readable by the PostHog client plugin
      secure: !import.meta.dev,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  } else {
    deleteCookie(event, cookieName, {
      path: '/',
    })
  }

  return { ok: true, tagged: enabled }
})
