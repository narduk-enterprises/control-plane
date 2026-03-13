/**
 * Deep sitemap analysis for a fleet app.
 * Fetches sitemap.xml (and follows sitemap index if present), optionally
 * runs HEAD requests on each URL to report status and response time.
 *
 * Query: ?deep=true to run HEAD checks (capped at 200 URLs).
 */
import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetAppByName } from '#server/data/fleet-registry'

const LOC_REGEX = /<loc>([^<]+)<\/loc>/gi
const MAX_INDEX_SITEMAPS = 10
const MAX_URLS_DEEP = 200
const FETCH_TIMEOUT_MS = 12_000
const HEAD_TIMEOUT_MS = 8_000

function extractLocUrls(xml: string): string[] {
  const urls: string[] = []
  let m: RegExpExecArray | null
  LOC_REGEX.lastIndex = 0
  while ((m = LOC_REGEX.exec(xml)) !== null) {
    const url = (m[1] ?? '').trim()
    if (url && !urls.includes(url)) urls.push(url)
  }
  return urls
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Narduk-Control-Plane-SitemapAnalysis/1' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

async function headWithTiming(
  url: string,
): Promise<{ status: number; durationMs: number; error?: string }> {
  const start = Date.now()
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Narduk-Control-Plane-SitemapAnalysis/1' },
    })
    clearTimeout(t)
    return { status: res.status, durationMs: Date.now() - start }
  } catch (e: unknown) {
    clearTimeout(t)
    const err = e instanceof Error ? e.message : String(e)
    return { status: 0, durationMs: Date.now() - start, error: err }
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-sitemap-analysis', 10, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = await getFleetAppByName(event, appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  const querySchema = z.object({ deep: z.enum(['true', 'false']).optional().default('false') })
  const query = querySchema.parse(getQuery(event))

  const baseUrl = app.url.replace(/\/$/, '')
  const sitemapUrl = `${baseUrl}/sitemap.xml`

  let allUrls: string[] = []
  try {
    const mainXml = await fetchText(sitemapUrl)
    const mainLocs = extractLocUrls(mainXml)
    const looksLikeIndex = mainLocs.some(
      (u) => u.endsWith('.xml') || u.toLowerCase().includes('sitemap'),
    )
    if (looksLikeIndex && mainLocs.length > 0) {
      const toFetch = mainLocs.slice(0, MAX_INDEX_SITEMAPS)
      const childXmls = await Promise.all(toFetch.map((url) => fetchText(url).catch(() => '')))
      const seen = new Set<string>()
      for (const xml of childXmls) {
        for (const u of extractLocUrls(xml)) {
          if (!seen.has(u)) {
            seen.add(u)
            allUrls.push(u)
          }
        }
      }
    } else {
      allUrls = mainLocs
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw createError({
      statusCode: 502,
      message: `Failed to fetch sitemap: ${msg}`,
    })
  }

  const summary = {
    totalUrls: allUrls.length,
    sitemapUrl,
    baseUrl,
  }

  if (query.deep !== 'true') {
    return { ...summary, urls: allUrls, entries: null }
  }

  const toCheck = allUrls.slice(0, MAX_URLS_DEEP)
  const entries: Array<{
    url: string
    status: number
    durationMs: number
    error?: string
  }> = []
  for (const url of toCheck) {
    const r = await headWithTiming(url)
    entries.push({
      url,
      status: r.status,
      durationMs: r.durationMs,
      ...(r.error && { error: r.error }),
    })
  }

  const ok = entries.filter((e) => e.status >= 200 && e.status < 400).length
  const error = entries.filter((e) => e.status >= 400 || e.status === 0).length
  const timeout = entries.filter((e) => e.error?.includes('abort')).length
  const avgMs =
    entries.length > 0
      ? Math.round(entries.reduce((a, e) => a + e.durationMs, 0) / entries.length)
      : 0

  return {
    ...summary,
    urls: allUrls,
    entries,
    deepSummary: {
      checked: entries.length,
      ok,
      error,
      timeout,
      avgDurationMs: avgMs,
    },
  }
})
