import { describe, expect, it } from 'vitest'
import { buildFleetD1NamingChecks } from '../../server/utils/fleet-d1-audit'

describe('buildFleetD1NamingChecks', () => {
  const app = { name: 'old-austin-grouch', databaseBackend: 'd1' as const }

  it('warns when both bare and -db exist', () => {
    const checks = buildFleetD1NamingChecks(app, [
      { name: 'old-austin-grouch' },
      { name: 'old-austin-grouch-db' },
    ])
    expect(checks).toHaveLength(1)
    expect(checks[0]?.status).toBe('warning')
    expect(checks[0]?.name).toBe('D1 database naming (Cloudflare)')
  })

  it('passes when only -db exists', () => {
    const checks = buildFleetD1NamingChecks(app, [{ name: 'old-austin-grouch-db' }])
    expect(checks[0]?.status).toBe('pass')
  })

  it('warns when only bare name exists', () => {
    const checks = buildFleetD1NamingChecks(app, [{ name: 'old-austin-grouch' }])
    expect(checks[0]?.status).toBe('warning')
    expect(checks[0]?.expected).toBe('old-austin-grouch-db')
  })

  it('skips when neither exists', () => {
    const checks = buildFleetD1NamingChecks(app, [{ name: 'other-db' }])
    expect(checks[0]?.status).toBe('skipped')
  })
})
