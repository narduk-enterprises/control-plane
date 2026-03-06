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
import type { FleetApp } from '#server/database/schema'
import type { H3Event } from 'h3'

export type { FleetApp }

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
