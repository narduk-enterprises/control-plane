/**
 * Global server error logger — Nitro plugin.
 *
 * Intercepts all unhandled errors and `createError` throws with status >= 500.
 * Emits structured logs via `console.error`, which surface in:
 *   - `wrangler tail` (live)
 *   - Cloudflare Dashboard → Workers → Logs
 *   - Logpush (if configured)
 *
 * Intentionally skips 4xx errors — those are expected application flow.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, { event }) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    if (statusCode < 500) return

    const method = event?.method ?? 'UNKNOWN'
    const path = event?.path ?? 'UNKNOWN'
    const timestamp = new Date().toISOString()

    console.error(`[SERVER ERROR] ${timestamp} ${method} ${path} → ${statusCode}`, {
      message: error.message,
      name: error.name,
      ...(error.cause ? { cause: String(error.cause) } : {}),
      stack: error.stack,
    })
  })
})
