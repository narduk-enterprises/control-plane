import { z } from 'zod'
import { GoogleApiError, googleApiFetch, GSC_SCOPES } from '#layer/server/utils/google'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { withD1Cache } from '#server/utils/d1-cache'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  compareStartDate: z.string().optional(),
  compareEndDate: z.string().optional(),
  force: z.enum(['true', 'false']).optional(),
})

/** Run GSC searchAnalytics/query with dimension date only. */
async function tryGscDateSeries(siteUrl: string, startDate: string, endDate: string) {
  const encoded = encodeURIComponent(siteUrl)
  try {
    const data = await googleApiFetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
      GSC_SCOPES,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['date'],
          rowLimit: 1000,
        }),
      },
    ) as Record<string, unknown>
    return { data, siteUrl }
  } catch (err: unknown) {
    if (err instanceof GoogleApiError && (err.status === 403 || err.status === 404)) {
      return null
    }
    throw err
  }
}

interface GscRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

function mapRowsToTimeSeries(rows: Array<Record<string, unknown>>): { date: string; clicks: number; impressions: number; ctr: number; position: number }[] {
  return (rows ?? []).map((row: Record<string, unknown>) => {
    const r = row as GscRow
    return {
      date: r.keys?.[0] ?? '',
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
      ctr: Number(r.ctr ?? 0),
      position: Number(r.position ?? 0),
    }
  }).filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date))
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-gsc-series', 30, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = await getFleetAppByName(event, appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  const parsed = querySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : {}
  let endDate = query.endDate ?? new Date().toISOString().split('T')[0] ?? ''
  const startObj = new Date(endDate)
  startObj.setDate(startObj.getDate() - 30)
  let startDate = query.startDate ?? startObj.toISOString().split('T')[0] ?? ''
  if (startDate > endDate) {
    const temp = startDate
    startDate = endDate
    endDate = temp
  }

  const hostname = new URL(app.url).hostname
  const scDomain = `sc-domain:${hostname}`
  const urlPrefix = `${app.url.replace(/\/$/, '')}/`

  const cacheKey = `gsc-series-${appSlug}-${startDate}-${endDate}-${query.compareStartDate ?? ''}-${query.compareEndDate ?? ''}`
  const TTL = 4 * 3600
  const staleWindow = 2 * 3600

  return withD1Cache(event, cacheKey, TTL, async () => {
    let result = await tryGscDateSeries(scDomain, startDate, endDate)
    if (!result) {
      result = await tryGscDateSeries(urlPrefix, startDate, endDate)
    }
    if (!result) {
      throw createError({
        statusCode: 403,
        message: `GSC: No access for '${scDomain}' or '${urlPrefix}'. Grant access in Google Search Console.`,
      })
    }

    const data = result.data as Record<string, unknown>
    const rows = (data.rows as Array<Record<string, unknown>>) ?? []
    const timeSeries = mapRowsToTimeSeries(rows)

    let compareTimeSeries: { date: string; clicks: number; impressions: number; ctr: number; position: number }[] | undefined
    if (query.compareStartDate && query.compareEndDate) {
      let compareStart = query.compareStartDate
      let compareEnd = query.compareEndDate
      if (compareStart > compareEnd) {
        const t = compareStart
        compareStart = compareEnd
        compareEnd = t
      }
      let compareResult = await tryGscDateSeries(scDomain, compareStart, compareEnd)
      if (!compareResult) compareResult = await tryGscDateSeries(urlPrefix, compareStart, compareEnd)
      if (compareResult) {
        const compareData = compareResult.data as Record<string, unknown>
        compareTimeSeries = mapRowsToTimeSeries((compareData.rows as Array<Record<string, unknown>>) ?? [])
      }
    }

    return {
      app: app.name,
      timeSeries,
      compareTimeSeries,
      startDate,
      endDate,
    }
  }, query.force === 'true', { staleWindowSeconds: staleWindow })
})
