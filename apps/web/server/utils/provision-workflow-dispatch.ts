/**
 * workflow_dispatch input keys for `.github/workflows/provision-app.yml`
 * (must stay in sync with that file).
 */
export const PROVISION_WORKFLOW_INPUT_KEYS = [
  'app-name',
  'display-name',
  'app-url',
  'app-short-description',
  'nuxt-port',
  'github-repo',
  'provision-id',
  'd1-database-id',
  'd1-database-name',
  'ga-property-id',
  'ga-measurement-id',
  'gsc-verification-file',
  'gsc-verification-content',
  'indexnow-key',
  'app-description',
] as const

export type ProvisionWorkflowInputKey = (typeof PROVISION_WORKFLOW_INPUT_KEYS)[number]

const KEY_SET = new Set<string>(PROVISION_WORKFLOW_INPUT_KEYS)

export function buildProvisionWorkflowDispatchInputs(params: {
  appName: string
  displayName: string
  appUrl: string
  githubRepo: string
  provisionId: string
  nuxtPort: string
  appShortDescription?: string
  appDescription?: string
  overrides?: Partial<Record<ProvisionWorkflowInputKey, string>>
}): Record<string, string> {
  const base: Record<string, string> = {
    'app-name': params.appName,
    'display-name': params.displayName,
    'app-url': params.appUrl,
    'app-short-description': params.appShortDescription ?? '',
    'github-repo': params.githubRepo,
    'provision-id': params.provisionId,
    'nuxt-port': params.nuxtPort,
    'd1-database-id': '',
    'd1-database-name': '',
    'ga-property-id': '',
    'ga-measurement-id': '',
    'gsc-verification-file': '',
    'gsc-verification-content': '',
    'indexnow-key': '',
    'app-description': params.appDescription ?? '',
  }
  if (params.overrides) {
    for (const [k, v] of Object.entries(params.overrides)) {
      if (v !== undefined && KEY_SET.has(k)) {
        base[k] = v
      }
    }
  }
  return base
}

export function parseStoredDispatchInputs(
  json: string | null | undefined,
): Record<string, string> | null {
  if (!json?.trim()) return null
  try {
    const parsed = JSON.parse(json) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (KEY_SET.has(k) && typeof v === 'string') {
        out[k] = v
      }
    }
    return out
  } catch {
    return null
  }
}

/** Apply patch; non-empty string values win. `provision-id` is ignored (set at dispatch). */
export function mergeDispatchInputs(
  current: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  const out = { ...current }
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'provision-id') continue
    if (!KEY_SET.has(k)) continue
    if (typeof v === 'string' && v.length > 0) {
      out[k] = v
    }
  }
  return out
}

export function dispatchInputsForRetry(job: {
  id: string
  appName: string
  displayName: string
  appUrl: string
  githubRepo: string
  nuxtPort: number | null
  gaPropertyId: string | null
  dispatchInputsJson: string | null
}): Record<string, string> {
  const stored = parseStoredDispatchInputs(job.dispatchInputsJson)
  let inputs = buildProvisionWorkflowDispatchInputs({
    appName: job.appName,
    displayName: job.displayName,
    appUrl: job.appUrl,
    githubRepo: job.githubRepo,
    provisionId: job.id,
    nuxtPort: job.nuxtPort != null ? String(job.nuxtPort) : '',
  })
  if (stored) {
    inputs = mergeDispatchInputs(inputs, stored)
  }
  inputs['provision-id'] = job.id
  if (job.gaPropertyId && !inputs['ga-property-id']) {
    inputs['ga-property-id'] = job.gaPropertyId
  }
  return inputs
}
