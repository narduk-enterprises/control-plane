import { z } from 'zod'
import { defineAdminMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'

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
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-provision-ui', maxRequests: 10, windowMs: 60_000 },
    parseBody: async (event) => readValidatedMutationBody(event, bodySchema.parse),
  },
  async ({ event, body }) => {
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
      body,
      headers: {
        Authorization: `Bearer ${config.provisionApiKey}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    return result
  },
)
