import type { FleetPostgresTarget } from '#server/utils/fleet-database-resolve'

const APP_PROXY_FALLBACK_STATUSES = new Set([404, 405, 501])

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function summarizeProxyErrorBody(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'empty response body'
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed
}

export interface FleetDatabaseAppProxyFailure {
  ok: false
  canFallback: boolean
  message: string
  statusCode?: number
}

export interface FleetDatabaseAppProxySuccess<T> {
  ok: true
  data: T
}

export type FleetDatabaseAppProxyResult<T> =
  | FleetDatabaseAppProxyFailure
  | FleetDatabaseAppProxySuccess<T>

export async function fetchFleetDatabaseAppProxy<T>(
  target: FleetPostgresTarget,
  options: {
    method: 'GET' | 'POST'
    path: string
    query?: Record<string, string | number | undefined | null>
    body?: unknown
  },
): Promise<FleetDatabaseAppProxyResult<T>> {
  if (!target.controlPlaneApiKey) {
    return {
      ok: false,
      canFallback: true,
      message: `Fleet app ${target.app.name} has no CONTROL_PLANE_API_KEY in Doppler.`,
    }
  }

  const appUrl = trimTrailingSlash(target.app.url || '')
  if (!appUrl) {
    return {
      ok: false,
      canFallback: true,
      message: `Fleet app ${target.app.name} has no registry URL.`,
    }
  }

  const url = new URL(`${appUrl}/api/control-plane/database${options.path}`)
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const headers = new Headers({
    accept: 'application/json',
    authorization: `Bearer ${target.controlPlaneApiKey}`,
  })

  let body: string | undefined
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(options.body)
  }

  try {
    const response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return {
        ok: false,
        canFallback: APP_PROXY_FALLBACK_STATUSES.has(response.status),
        statusCode: response.status,
        message: `Fleet app database proxy returned ${response.status}: ${summarizeProxyErrorBody(text)}`,
      }
    }

    return {
      ok: true,
      data: (await response.json()) as T,
    }
  } catch (error) {
    return {
      ok: false,
      canFallback: true,
      message: `Fleet app database proxy request failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
