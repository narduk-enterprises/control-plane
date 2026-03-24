/**
 * POST merged workflow_dispatch snapshot fields to the control plane (PROVISION_API_KEY).
 * Reads non-empty values from the environment (typically GITHUB_ENV after prior steps).
 */

async function main() {
  const provisionId = process.argv.find((a) => a.startsWith('--provision-id='))?.split('=')[1]
  const baseUrl = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '')
  const apiKey = process.env.PROVISION_API_KEY

  if (!provisionId) throw new Error('--provision-id is required')
  if (!baseUrl) throw new Error('CONTROL_PLANE_URL is required')
  if (!apiKey) throw new Error('PROVISION_API_KEY is required')

  const patch: Record<string, string> = {}

  const set = (key: string, value: string | undefined) => {
    const v = value?.trim()
    if (v) patch[key] = v
  }

  set('d1-database-id', process.env.D1_DATABASE_ID)
  set('d1-database-name', process.env.D1_DATABASE_NAME)
  set('ga-property-id', process.env.GA_PROPERTY_ID)
  set('ga-measurement-id', process.env.GA_MEASUREMENT_ID)
  set('gsc-verification-file', process.env.GSC_VERIFICATION_FILE)
  set('indexnow-key', process.env.INDEXNOW_KEY)

  const gscContent = process.env.GSC_VERIFICATION_CONTENT
  if (gscContent != null && gscContent !== '') {
    patch['gsc-verification-content'] = gscContent
  }

  if (Object.keys(patch).length === 0) {
    console.log('No dispatch context fields to persist; skipping.')
    return
  }

  const res = await fetch(`${baseUrl}/api/fleet/provision/${provisionId}/dispatch-context`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(patch),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`dispatch-context failed: ${res.status} ${text}`)
  }

  console.log(`✅ Persisted dispatch context keys: ${Object.keys(patch).join(', ')}`)
}

main().catch((err) => {
  console.error('❌ Persist dispatch context failed:', err)
  process.exit(1)
})
