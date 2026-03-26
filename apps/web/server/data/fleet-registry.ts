/**
 * Public Fleet App Registry.
 *
 * Runtime monitoring, analytics, and status checks read from the `fleet_apps`
 * D1 table. The broader managed-repo catalog for sync/orchestration lives in
 * `managed-repos.ts`; this table is the public-app slice seeded from that
 * catalog.
 */
import { eq } from 'drizzle-orm'
import { fleetApps } from '#server/database/schema'
import { getD1CacheDB } from '#layer/server/utils/d1Cache'
import type { FleetApp } from '#server/database/schema'
import type { H3Event } from 'h3'

export type { FleetApp }

const FLEET_APP_CACHE_KEYS = ['fleet-apps-list', 'fleet-apps-list-all'] as const

/**
 * Get all active fleet apps from D1, sorted by name.
 */
export async function getFleetApps(event: H3Event): Promise<FleetApp[]> {
  const db = useDatabase(event)
  const rows = await db.select().from(fleetApps).where(eq(fleetApps.isActive, true)).all()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get all fleet apps including inactive ones.
 */
export async function getAllFleetApps(event: H3Event): Promise<FleetApp[]> {
  const db = useDatabase(event)
  const rows = await db.select().from(fleetApps).all()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * `fleet_apps.is_active` keyed by app name. Used to align managed-repo catalog
 * rows with control-plane registry state (e.g. fleet sync skipping inactive apps).
 */
export async function getFleetAppIsActiveByName(event: H3Event): Promise<Map<string, boolean>> {
  const db = useDatabase(event)
  const rows = await db
    .select({ name: fleetApps.name, isActive: fleetApps.isActive })
    .from(fleetApps)
    .all()
  return new Map(rows.map((r) => [r.name, r.isActive]))
}

/**
 * Find a single fleet app by name (active only).
 */
export async function getFleetAppByName(
  event: H3Event,
  name: string,
): Promise<FleetApp | undefined> {
  const db = useDatabase(event)
  const rows = await db.select().from(fleetApps).where(eq(fleetApps.name, name)).limit(1).all()
  return rows[0]
}

export async function invalidateFleetAppListCache(event: H3Event): Promise<number> {
  const d1 = getD1CacheDB(event)
  if (!d1) return 0

  const placeholders = FLEET_APP_CACHE_KEYS.map(() => '?').join(', ')
  const result = await d1
    .prepare(`DELETE FROM kv_cache WHERE key IN (${placeholders})`)
    .bind(...FLEET_APP_CACHE_KEYS)
    .run()

  return result.meta?.changes ?? 0
}
