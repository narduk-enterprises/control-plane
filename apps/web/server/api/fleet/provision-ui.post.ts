import { z } from 'zod'
import { readBody } from 'h3'
import { requireAdmin } from '#layer/server/utils/auth'

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      'Must be lowercase alphanumeric with hyphens, starting with a letter or number',
    ),
  displayName: z.string().min(1).max(200),
  url: z.string().url(),
})

/**
 * POST /api/fleet/provision-ui
 *
 * Session-auth'd wrapper around the PROVISION_API_KEY-protected provision endpoint.
 * Called by the browser UI — proxies to POST /api/fleet/provision with the server-side API key.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    })
  }

  const config = useRuntimeConfig(event)
  if (!config.provisionApiKey) {
    throw createError({
      statusCode: 500,
      message: 'PROVISION_API_KEY not configured on this control plane instance.',
    })
  }

  // Use event.$fetch to preserve Cloudflare platform bindings (D1, KV, etc.)
  const result = await event.$fetch('/api/fleet/provision', {
    method: 'POST',
    body: parsed.data,
    headers: {
      Authorization: `Bearer ${config.provisionApiKey}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  return result
})
