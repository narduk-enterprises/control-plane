/**
 * App-specific database schema.
 * Re-exports the layer's base tables and adds control-plane–specific tables.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export * from '../../../../layers/narduk-nuxt-layer/server/database/schema'

// ─── Fleet App Status ───────────────────────────────────────
export const appStatus = sqliteTable('app_status', {
    app: text('app').primaryKey(),
    url: text('url').notNull(),
    status: text('status').notNull(), // 'up' | 'down'
    statusCode: integer('status_code'),
    checkedAt: text('checked_at').notNull().$defaultFn(() => new Date().toISOString()),
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

// ─── Type helpers ───────────────────────────────────────────
export type AppStatus = typeof appStatus.$inferSelect
export type NewAppStatus = typeof appStatus.$inferInsert
export type KvCache = typeof kvCache.$inferSelect
export type NewKvCache = typeof kvCache.$inferInsert
