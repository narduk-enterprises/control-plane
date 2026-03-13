import { getFleetApps, getFleetAppByName } from '#server/data/fleet-registry'
import { appStatus } from '#server/database/schema'
import type { AppStatus } from '#server/database/schema'
import type { H3Event } from 'h3'

/**
 * Check the status of a single URL via HEAD (fallback to GET).
 */
async function checkUrl(url: string): Promise<{ status: 'up' | 'down'; code: number }> {
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow' })

    if (response.status === 405 || response.status >= 500) {
      response = await fetch(url, { method: 'GET', redirect: 'follow' })
    }

    return response.ok
      ? { status: 'up', code: response.status }
      : { status: 'down', code: response.status }
  } catch {
    return { status: 'down', code: 0 }
  }
}

/**
 * Check all fleet apps and upsert results into the `app_status` table.
 * Returns the full set of statuses after writing.
 */
export async function checkAllFleetStatuses(event: H3Event): Promise<AppStatus[]> {
  const db = useDatabase(event)
  const apps = await getFleetApps(event)
  const now = new Date().toISOString()

  const results = await Promise.allSettled(
    // eslint-disable-next-line narduk/no-map-async-in-server -- Intentional: parallel HTTP checks, not DB queries
    apps.map(async (app) => {
      const { status, code } = await checkUrl(app.url)
      return {
        app: app.name,
        url: app.url,
        status,
        statusCode: code,
        checkedAt: now,
        indexnowLastSubmission: null,
        indexnowTotalSubmissions: 0,
        indexnowLastSubmittedCount: null,
      }
    }),
  )

  const rows: AppStatus[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const row = result.value
      await db
        .insert(appStatus)
        .values(row)
        .onConflictDoUpdate({
          target: appStatus.app,
          set: {
            url: row.url,
            status: row.status,
            statusCode: row.statusCode,
            checkedAt: row.checkedAt,
          },
        })
      rows.push(row)
    }
  }

  return rows
}

/**
 * Check a single fleet app and upsert the result into the `app_status` table.
 * Returns the fresh status row. Throws an error if the app is not in the registry.
 */
export async function checkSingleFleetAppStatus(
  event: H3Event,
  appName: string,
): Promise<AppStatus> {
  const db = useDatabase(event)
  const app = await getFleetAppByName(event, appName)

  if (!app) {
    throw createError({ statusCode: 404, message: `App '${appName}' not found in registry.` })
  }

  const now = new Date().toISOString()
  const { status, code } = await checkUrl(app.url)

  const row: AppStatus = {
    app: app.name,
    url: app.url,
    status,
    statusCode: code,
    checkedAt: now,
    indexnowLastSubmission: null,
    indexnowTotalSubmissions: 0,
    indexnowLastSubmittedCount: null,
  }

  await db
    .insert(appStatus)
    .values(row)
    .onConflictDoUpdate({
      target: appStatus.app,
      set: {
        url: row.url,
        status: row.status,
        statusCode: row.statusCode,
        checkedAt: row.checkedAt,
      },
    })

  return row
}
