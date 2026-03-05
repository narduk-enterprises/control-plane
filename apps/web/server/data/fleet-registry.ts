/**
 * Fleet Registry — Single source of truth for narduk-enterprises fleet apps.
 *
 * All app data lives in the `fleet_apps` D1 table. This module provides
 * async helpers to query it. Apps are managed via the control plane UI
 * at /fleet/manage or via the CRUD API at /api/fleet/apps.
 *
 * Migration: See drizzle/0003_fleet_apps.sql
 * Seed:      See tools/seed-fleet-apps.ts
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
export async function getFleetAppByName(event: H3Event, name: string): Promise<FleetApp | undefined> {
    const db = useDatabase(event)
    const rows = await db.select().from(fleetApps)
        .where(eq(fleetApps.name, name))
        .limit(1)
        .all()
    return rows[0]
}
