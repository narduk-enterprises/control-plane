/**
 * D1/default app-owned schema bridge.
 *
 * Legacy downstream apps may still define product tables directly in
 * schema.ts. Keep this bridge file present so #server/app-orm-tables
 * resolves consistently for auth helpers and runtime queries.
 */
export * from '#server/database/auth-bridge-schema'
export * from './schema'
