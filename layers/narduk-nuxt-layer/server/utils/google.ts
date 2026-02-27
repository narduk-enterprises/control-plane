export const GA_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
]

export const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
]

/**
 * Fetch from Google APIs using service account credentials.
 * This is a placeholder implementation; the actual implementation requires
 * google-auth-library or similar to get a valid access token.
 */
export async function googleApiFetch(url: string, scopes: string[], options: RequestInit = {}) {
  // In a real application, you would generate a JWT token from the service account
  // credentials and exchange it for an access token.
  const token = 'MOCK_TOKEN' // TODO: Implement actual token generation

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
