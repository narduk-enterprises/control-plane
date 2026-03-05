import { describe, it, expect, vi } from 'vitest'
import { hashPassword, verifyPassword } from '../../server/utils/password'

describe('password', () => {
  it('hashPassword returns salt:hash format', async () => {
    const hash = await hashPassword('test-password')
    expect(hash).toContain(':')
    const [salt, derived] = hash.split(':')
    expect(salt).toHaveLength(32) // 16 bytes = 32 hex chars
    expect(derived).toHaveLength(64) // 256 bits = 32 bytes = 64 hex chars
  })

  it('hashPassword produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('same-password')
    const hash2 = await hashPassword('same-password')
    expect(hash1).not.toBe(hash2)
  })

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correct-password')
    const result = await verifyPassword('correct-password', hash)
    expect(result).toBe(true)
  })

  it('verifyPassword returns false for incorrect password', async () => {
    const hash = await hashPassword('correct-password')
    const result = await verifyPassword('wrong-password', hash)
    expect(result).toBe(false)
  })

  it('verifyPassword returns false for malformed stored hash', async () => {
    expect(await verifyPassword('test', '')).toBe(false)
    expect(await verifyPassword('test', 'no-colon')).toBe(false)
    expect(await verifyPassword('test', ':')).toBe(false)
  })
})
