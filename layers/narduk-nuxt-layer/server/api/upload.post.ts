/**
 * Generic R2 image upload endpoint.
 *
 * Requires auth (requireAuth). Accepts multipart form data with a single file.
 * Stores the file in R2 under `uploads/<uuid>.<ext>` and returns the key.
 *
 * Requires an R2 bucket binding in wrangler.json:
 * ```json
 * { "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "my-bucket" }] }
 * ```
 */

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const file = formData[0]
  if (!file || !file.data || !file.type) {
    throw createError({ statusCode: 400, message: 'Invalid file data' })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    throw createError({ statusCode: 400, message: `Unsupported file type: ${file.type}` })
  }

  if (file.data.byteLength > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, message: 'File exceeds 10MB limit' })
  }

  const ext = file.type.split('/')[1]?.replace('svg+xml', 'svg') ?? 'bin'
  const key = `uploads/${crypto.randomUUID()}.${ext}`

  await uploadToR2(event, key, file.data.buffer as ArrayBuffer, file.type)

  return { key, url: `/images/${key}` }
})
