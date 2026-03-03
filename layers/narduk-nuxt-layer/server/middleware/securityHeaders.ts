/**
 * Security headers middleware.
 *
 * Sets standard security headers on every response to protect against
 * common web vulnerabilities. These supplement Cloudflare's built-in
 * protections with application-level defense-in-depth.
 */
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://us.i.posthog.com https://us-assets.i.posthog.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://www.google-analytics.com https://us.i.posthog.com https://us-assets.i.posthog.com",
      "frame-ancestors 'none'",
    ].join('; '),
  })
})
