import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { GSC_WRITE_SCOPES, GoogleApiError, getAccessToken } from '#layer/server/utils/google'
import { getFleetApps, type FleetApp } from '#server/data/fleet-registry'
import { appStatus, gscSitemapSubmitLog } from '#server/database/schema'
import { resolveGscPropertySiteUrl } from '#server/utils/fleet-analytics'

const SITEMAP_FETCH_UA = 'Narduk-Control-Plane-GscSitemap/1'
const SITEMAP_FETCH_TIMEOUT_MS = 12_000

export function fleetSitemapFullUrl(appUrl: string): string {
  const u = new URL(appUrl)
  return `${u.origin}/sitemap.xml`
}

export async function sha256HexOfText(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function fetchFleetSitemapBody(
  appUrl: string,
): Promise<
  | { ok: true; body: string; sitemapUrl: string }
  | { ok: false; sitemapUrl: string; message: string; status: number }
> {
  const sitemapUrl = fleetSitemapFullUrl(appUrl)
  try {
    const res = await fetch(sitemapUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': SITEMAP_FETCH_UA },
      signal: AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        sitemapUrl,
        message: `Sitemap HTTP ${res.status}`,
        status: res.status,
      }
    }
    return { ok: true, body, sitemapUrl }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sitemap fetch failed'
    return { ok: false, sitemapUrl, message, status: 0 }
  }
}

/**
 * Register or refresh a sitemap URL under a Search Console property.
 * 204/200/409 are treated as success.
 */
export async function putGscSitemapFeed(
  gscPropertySiteUrl: string,
  sitemapFullUrl: string,
): Promise<void> {
  const token = await getAccessToken(GSC_WRITE_SCOPES)
  const encSite = encodeURIComponent(gscPropertySiteUrl)
  const encFeed = encodeURIComponent(sitemapFullUrl)
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encSite}/sitemaps/${encFeed}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (response.ok || response.status === 409) return
  const text = await response.text().catch(() => '')
  let body: unknown = text
  try {
    body = JSON.parse(text) as unknown
  } catch {
    /* keep raw text */
  }
  throw new GoogleApiError(
    `GSC sitemap PUT failed: ${response.status} ${response.statusText}`,
    response.status,
    response.statusText,
    body,
  )
}

export interface FleetGscSitemapSubmitOptions {
  force: boolean
  trigger: 'manual' | 'cron'
}

export type FleetGscSitemapSubmitOutcome =
  | {
      ok: true
      action: 'submitted' | 'unchanged'
      app: string
      gscSiteUrl?: string
      sitemapUrl: string
      fingerprint: string
    }
  | { ok: false; app: string; sitemapUrl?: string; message: string; statusCode?: number }

function truncateLogMessage(msg: string, max = 500): string {
  return msg.length > max ? `${msg.slice(0, max - 1)}…` : msg
}

/**
 * Fetch sitemap, optionally submit to GSC when fingerprint is new or force=true.
 * Persists fingerprint, timestamps, optional log row, and increments submission count on success.
 */
export async function submitFleetAppGscSitemap(
  event: H3Event,
  app: FleetApp,
  options: FleetGscSitemapSubmitOptions,
): Promise<FleetGscSitemapSubmitOutcome> {
  const config = useRuntimeConfig()
  if (!config.googleServiceAccountKey) {
    return {
      ok: false,
      app: app.name,
      message:
        'GSC not configured: set GSC_SERVICE_ACCOUNT_JSON (service account needs webmasters scope for sitemap submission).',
    }
  }

  const fetched = await fetchFleetSitemapBody(app.url)
  if (!fetched.ok) {
    return {
      ok: false,
      app: app.name,
      sitemapUrl: fetched.sitemapUrl,
      message: fetched.message,
      statusCode: fetched.status,
    }
  }

  const fingerprint = await sha256HexOfText(fetched.body)
  const now = new Date().toISOString()
  const db = useDatabase(event)
  const logId = crypto.randomUUID()

  const [row] = await db.select().from(appStatus).where(eq(appStatus.app, app.name)).limit(1).all()

  if (!options.force && row?.gscSitemapFingerprint === fingerprint) {
    await db.update(appStatus).set({ gscSitemapCheckedAt: now }).where(eq(appStatus.app, app.name))
    return {
      ok: true,
      action: 'unchanged',
      app: app.name,
      sitemapUrl: fetched.sitemapUrl,
      fingerprint,
    }
  }

  let gscSiteUrl: string
  try {
    const resolved = await resolveGscPropertySiteUrl(app)
    if (!resolved) {
      const msg = `No GSC property access for ${app.url} (try sc-domain or URL-prefix in Search Console).`
      await db.insert(gscSitemapSubmitLog).values({
        id: logId,
        app: app.name,
        submittedAt: now,
        ok: false,
        trigger: options.trigger,
        sitemapUrl: fetched.sitemapUrl,
        gscProperty: null,
        message: truncateLogMessage(msg),
      })
      await db
        .update(appStatus)
        .set({ gscSitemapCheckedAt: now })
        .where(eq(appStatus.app, app.name))
      return {
        ok: false,
        app: app.name,
        sitemapUrl: fetched.sitemapUrl,
        message: msg,
        statusCode: 403,
      }
    }
    gscSiteUrl = resolved
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'GSC property resolution failed'
    await db.insert(gscSitemapSubmitLog).values({
      id: logId,
      app: app.name,
      submittedAt: now,
      ok: false,
      trigger: options.trigger,
      sitemapUrl: fetched.sitemapUrl,
      gscProperty: null,
      message: truncateLogMessage(msg),
    })
    await db.update(appStatus).set({ gscSitemapCheckedAt: now }).where(eq(appStatus.app, app.name))
    return { ok: false, app: app.name, sitemapUrl: fetched.sitemapUrl, message: msg }
  }

  try {
    await putGscSitemapFeed(gscSiteUrl, fetched.sitemapUrl)
  } catch (e) {
    let msg = e instanceof Error ? e.message : 'GSC sitemap submit failed'
    let statusCode: number | undefined
    if (e instanceof GoogleApiError) {
      statusCode = e.status
      msg = `${e.message} ${typeof e.body === 'string' ? e.body : JSON.stringify(e.body)}`
    }
    await db.insert(gscSitemapSubmitLog).values({
      id: logId,
      app: app.name,
      submittedAt: now,
      ok: false,
      trigger: options.trigger,
      sitemapUrl: fetched.sitemapUrl,
      gscProperty: gscSiteUrl,
      message: truncateLogMessage(msg),
    })
    await db.update(appStatus).set({ gscSitemapCheckedAt: now }).where(eq(appStatus.app, app.name))
    return { ok: false, app: app.name, sitemapUrl: fetched.sitemapUrl, message: msg, statusCode }
  }

  await db.insert(gscSitemapSubmitLog).values({
    id: logId,
    app: app.name,
    submittedAt: now,
    ok: true,
    trigger: options.trigger,
    sitemapUrl: fetched.sitemapUrl,
    gscProperty: gscSiteUrl,
    message: null,
  })

  await db
    .update(appStatus)
    .set({
      gscSitemapFingerprint: fingerprint,
      gscSitemapCheckedAt: now,
      gscSitemapLastSubmittedAt: now,
      gscSitemapTotalSubmissions: sql`${appStatus.gscSitemapTotalSubmissions} + 1`,
    })
    .where(eq(appStatus.app, app.name))

  return {
    ok: true,
    action: 'submitted',
    app: app.name,
    gscSiteUrl,
    sitemapUrl: fetched.sitemapUrl,
    fingerprint,
  }
}

export interface GscSitemapCronSummary {
  scanned: number
  unchanged: number
  submitted: number
  failed: number
  skippedConfig: boolean
  ms: number
}

/**
 * Hourly cron: submit to GSC only when sitemap body fingerprint changed (or first seen).
 */
export async function runFleetGscSitemapCronSync(
  event: H3Event,
  opts: { startedAt: number; deadlineMs: number },
): Promise<GscSitemapCronSummary> {
  const t0 = Date.now()
  const config = useRuntimeConfig()
  if (!config.googleServiceAccountKey) {
    return {
      scanned: 0,
      unchanged: 0,
      submitted: 0,
      failed: 0,
      skippedConfig: true,
      ms: Date.now() - t0,
    }
  }

  const apps = await getFleetApps(event)
  let unchanged = 0
  let submitted = 0
  let failed = 0
  let scanned = 0

  for (const app of apps) {
    if (Date.now() - opts.startedAt > opts.deadlineMs - 2_000) break
    scanned++
    const result = await submitFleetAppGscSitemap(event, app, { force: false, trigger: 'cron' })
    if (!result.ok) {
      failed++
      continue
    }
    if (result.action === 'unchanged') unchanged++
    else submitted++
  }

  return {
    scanned,
    unchanged,
    submitted,
    failed,
    skippedConfig: false,
    ms: Date.now() - t0,
  }
}
