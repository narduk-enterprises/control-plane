import { z } from 'zod'

const bodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).optional().default('URL_UPDATED'),
})

/**
 * Google Indexing API — batch publish URL notifications.
 *
 * POST /api/admin/indexing/batch
 * Body: { urls: string[], type?: "URL_UPDATED" | "URL_DELETED" }
 *
 * Submits up to 100 URLs in a single batch request using Google's
 * multipart/mixed batch API.
 *
 * Requires GSC_SERVICE_ACCOUNT_JSON with the Indexing API enabled.
 *
 * Note: Google officially limits the Indexing API to pages with JobPosting
 * or BroadcastEvent structured data, but may process other page types.
 *
 * Usage:
 *   curl -X POST https://your-site.com/api/admin/indexing/batch \
 *     -H "Content-Type: application/json" \
 *     -d '{"urls": ["https://your-site.com/jobs/1", "https://your-site.com/jobs/2"]}'
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'google-indexing-batch', 5, 60_000)

  const body = await readBody<unknown>(event)
  const parsed = bodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    })
  }

  const { urls, type } = parsed.data as { urls: string[]; type: string }

  // Generate a unique boundary for the multipart request
  const boundary = `===============${Date.now()}==`
  const batchBody = buildBatchBody(urls, type, boundary)

  // Get an access token for the Indexing API scope
  const config = useRuntimeConfig()
  const saKeyJson = config.googleServiceAccountKey
  if (!saKeyJson) {
    throw createError({
      statusCode: 500,
      statusMessage: 'GSC_SERVICE_ACCOUNT_JSON not configured',
    })
  }

  // Use googleApiFetch's underlying auth mechanism — but we need raw access
  // for the batch endpoint since it uses multipart/mixed, not JSON
  const { SignJWT, importPKCS8 } = await import('jose')

  const decoded = saKeyJson.trim().startsWith('{') ? saKeyJson : atob(saKeyJson)
  const sa = JSON.parse(decoded) as { client_email: string; private_key: string }
  const privateKey = await importPKCS8(sa.private_key, 'RS256')

  const now = Math.floor(Date.now() / 1000)
  const jwt = await new SignJWT({
    iss: sa.client_email,
    sub: sa.client_email,
    scope: INDEXING_SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey)

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    throw createError({
      statusCode: 500,
      statusMessage: `Google token exchange failed: ${errorText}`,
    })
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string }

  try {
    const response = await fetch('https://indexing.googleapis.com/batch', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/mixed; boundary="${boundary}"`,
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: batchBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw createError({
        statusCode: response.status,
        statusMessage: `Google Indexing API batch error: ${errorText}`,
      })
    }

    const responseText = await response.text()
    const responseBoundary =
      response.headers.get('content-type')?.match(/boundary=(.+)/)?.[1] || boundary
    const results = parseBatchResponse(responseText, responseBoundary)

    return {
      success: true,
      submitted: urls.length,
      type,
      results,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    const err = error as { message?: string }
    throw createError({
      statusCode: 500,
      statusMessage: `Google Indexing API batch error: ${err.message}`,
    })
  }
})
