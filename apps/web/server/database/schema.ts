/**
 * App-specific database schema.
 * Re-exports the layer's base tables and adds control-plane–specific tables.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
export * from '#layer/server/database/schema'
// ─── Fleet Apps Registry ────────────────────────────────────
// Public app registry used by status/audit/analytics APIs. Seeded from the
// managed-repo catalog in server/data/managed-repos.ts.
export const fleetApps = sqliteTable('fleet_apps', {
  name: text('name').primaryKey(),
  url: text('url').notNull(),
  dopplerProject: text('doppler_project').notNull(),
  nuxtPort: integer('nuxt_port'),
  gaPropertyId: text('ga_property_id'),
  gaMeasurementId: text('ga_measurement_id'),
  posthogAppName: text('posthog_app_name'),
  githubRepo: text('github_repo'),
  appDescription: text('app_description'),
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
  gscSitemapFingerprint: text('gsc_sitemap_fingerprint'),
  gscSitemapCheckedAt: text('gsc_sitemap_checked_at'),
  gscSitemapLastSubmittedAt: text('gsc_sitemap_last_submitted_at'),
  gscSitemapTotalSubmissions: integer('gsc_sitemap_total_submissions').notNull().default(0),
})

// ─── IndexNow ping audit (fleet proxy) ─────────────────────
export const indexnowPingLog = sqliteTable('indexnow_ping_log', {
  id: text('id').primaryKey(),
  app: text('app').notNull(),
  pingedAt: text('pinged_at').notNull(),
  ok: integer('ok', { mode: 'boolean' }).notNull(),
  downstreamStatus: integer('downstream_status'),
  urlCount: integer('url_count'),
  targetUrl: text('target_url'),
  message: text('message'),
})

export const gscSitemapSubmitLog = sqliteTable('gsc_sitemap_submit_log', {
  id: text('id').primaryKey(),
  app: text('app').notNull(),
  submittedAt: text('submitted_at').notNull(),
  ok: integer('ok', { mode: 'boolean' }).notNull(),
  trigger: text('trigger').notNull(),
  sitemapUrl: text('sitemap_url'),
  gscProperty: text('gsc_property'),
  message: text('message'),
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
  nuxtPort: integer('nuxt_port'),
  status: text('status').notNull().default('pending'), // pending → creating_repo → dispatching → cloning → initializing → deploying → complete | failed
  deployedUrl: text('deployed_url'),
  gaPropertyId: text('ga_property_id'),
  /** Last workflow_dispatch inputs (JSON) for full parity on retry */
  dispatchInputsJson: text('dispatch_inputs_json'),
  errorMessage: text('error_message'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// ─── Provision Job Logs ──────────────────────────────────────
// Detailed log events from the provisioning pipeline
export const provisionJobLogs = sqliteTable('provision_job_logs', {
  id: text('id').primaryKey(),
  provisionId: text('provision_id')
    .notNull()
    .references(() => provisionJobs.id, { onDelete: 'cascade' }),
  level: text('level').notNull().default('info'), // 'info', 'error', 'success'
  message: text('message').notNull(),
  step: text('step'),
  createdAt: text('created_at')
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
export type ProvisionJobLog = typeof provisionJobLogs.$inferSelect
export type NewProvisionJobLog = typeof provisionJobLogs.$inferInsert
export type IndexnowPingLog = typeof indexnowPingLog.$inferSelect
export type NewIndexnowPingLog = typeof indexnowPingLog.$inferInsert
export type GscSitemapSubmitLog = typeof gscSitemapSubmitLog.$inferSelect
export type NewGscSitemapSubmitLog = typeof gscSitemapSubmitLog.$inferInsert
