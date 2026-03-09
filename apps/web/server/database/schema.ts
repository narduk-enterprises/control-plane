/**
 * App-specific database schema.
 * Re-exports the layer's base tables and adds control-plane–specific tables.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export * from '../../../../layers/narduk-nuxt-layer/server/database/schema'

// ─── Fleet Apps Registry ────────────────────────────────────
// Public app registry used by status/audit/analytics APIs. Seeded from the
// managed-repo catalog in server/data/managed-repos.ts.
export const fleetApps = sqliteTable('fleet_apps', {
  name: text('name').primaryKey(),
  url: text('url').notNull(),
  dopplerProject: text('doppler_project').notNull(),
  gaPropertyId: text('ga_property_id'),
  gaMeasurementId: text('ga_measurement_id'),
  posthogAppName: text('posthog_app_name'),
  githubRepo: text('github_repo'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// ─── Fleet App Status ───────────────────────────────────────
export const appStatus = sqliteTable('app_status', {
  app: text('app').primaryKey(),
  url: text('url').notNull(),
  status: text('status').notNull(), // 'up' | 'down'
  statusCode: integer('status_code'),
  checkedAt: text('checked_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  indexnowLastSubmission: text('indexnow_last_submission'),
  indexnowTotalSubmissions: integer('indexnow_total_submissions').notNull().default(0),
  indexnowLastSubmittedCount: integer('indexnow_last_submitted_count'),
})

// ─── KV Cache ───────────────────────────────────────────────
export const kvCache = sqliteTable('kv_cache', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at').notNull(),
})

// ─── Provision Jobs ─────────────────────────────────────────
// Tracks async app provisioning pipeline (control plane → GitHub Action → callback)
export const provisionJobs = sqliteTable('provision_jobs', {
  id: text('id').primaryKey(),
  appName: text('app_name').notNull(),
  displayName: text('display_name').notNull(),
  appUrl: text('app_url').notNull(),
  githubRepo: text('github_repo').notNull(),
  status: text('status').notNull().default('pending'), // pending → cloning → initializing → deploying → complete | failed
  deployedUrl: text('deployed_url'),
  gaPropertyId: text('ga_property_id'),
  errorMessage: text('error_message'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// ─── Type helpers ───────────────────────────────────────────
export type FleetApp = typeof fleetApps.$inferSelect
export type NewFleetApp = typeof fleetApps.$inferInsert
export type AppStatus = typeof appStatus.$inferSelect
export type NewAppStatus = typeof appStatus.$inferInsert
export type KvCache = typeof kvCache.$inferSelect
export type NewKvCache = typeof kvCache.$inferInsert
export type ProvisionJob = typeof provisionJobs.$inferSelect
export type NewProvisionJob = typeof provisionJobs.$inferInsert
