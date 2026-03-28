import { describe, expect, it } from 'vitest'
import {
  normalizeFleetDatabaseBackend,
  resolveFleetDatabaseBackendFromSources,
} from '../../server/utils/fleet-database-backend'

describe('fleet database backend resolution', () => {
  it('keeps unknown stored backend values nullable', () => {
    expect(normalizeFleetDatabaseBackend(null)).toBeNull()
    expect(normalizeFleetDatabaseBackend('')).toBeNull()
  })

  it('falls back to Doppler when the stored backend is missing', () => {
    expect(
      resolveFleetDatabaseBackendFromSources(null, { NUXT_DATABASE_BACKEND: 'postgres' }),
    ).toBe('postgres')
  })

  it('prefers explicit stored metadata over Doppler fallback', () => {
    expect(
      resolveFleetDatabaseBackendFromSources('d1', { NUXT_DATABASE_BACKEND: 'postgres' }),
    ).toBe('d1')
  })

  it('normalizes quoted and mixed-case backend values', () => {
    expect(normalizeFleetDatabaseBackend(' Postgres ')).toBe('postgres')
    expect(normalizeFleetDatabaseBackend('D1')).toBe('d1')
  })
})
