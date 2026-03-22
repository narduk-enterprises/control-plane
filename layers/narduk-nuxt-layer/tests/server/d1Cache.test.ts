import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withD1Cache, cleanExpiredCache, deleteD1CacheKeys } from '../../server/utils/d1Cache'

// Mock createError auto-import
vi.stubGlobal('createError', (opts: { statusCode: number; message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
})

// Mock useRuntimeConfig auto-import (required by useLogger → resolveLogLevel)
vi.stubGlobal('useRuntimeConfig', () => ({ logLevel: 'silent' }))

// Stub useLogger auto-import — returns a silent no-op logger with child() support
function createNoopLogger(): {
  debug: () => void
  info: () => void
  warn: () => void
  error: () => void
  child: () => ReturnType<typeof createNoopLogger>
} {
  return { debug() {}, info() {}, warn() {}, error() {}, child: () => createNoopLogger() }
}
vi.stubGlobal('useLogger', () => createNoopLogger())

describe('withD1Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls fetcher and returns result when D1 is not available', async () => {
    const event = { context: {} } as never
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' })

    const result = await withD1Cache(event, 'test-key', 300, fetcher)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(result).toEqual({ data: 'fresh' })
  })

  it('calls fetcher and returns result when cloudflare env has no DB', async () => {
    const event = { context: { cloudflare: { env: {} } } } as never
    const fetcher = vi.fn().mockResolvedValue({ value: 42 })

    const result = await withD1Cache(event, 'test-key', 300, fetcher)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(result).toEqual({ value: 42 })
  })

  it('calls fetcher when force is true even if D1 is available', async () => {
    const mockPrepare = vi.fn()
    const event = {
      context: {
        cloudflare: {
          env: { DB: { prepare: mockPrepare } },
        },
      },
    } as never
    const fetcher = vi.fn().mockResolvedValue('forced')

    const result = await withD1Cache(event, 'test-key', 300, fetcher, true)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(result).toBe('forced')
    // Prepare should be called for the SET operation, not for GET
    expect(mockPrepare).toHaveBeenCalled()
  })

  it('wraps result with meta when returnMeta is true', async () => {
    const event = { context: {} } as never
    const fetcher = vi.fn().mockResolvedValue({ value: 'test' })

    const result = await withD1Cache(event, 'key', 300, fetcher, false, { returnMeta: true })

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('_meta')
    expect((result as { data: unknown; _meta: { stale: boolean } })._meta.stale).toBe(false)
    expect((result as { data: unknown }).data).toEqual({ value: 'test' })
  })

  it('uses Cloudflare waitUntil to refresh stale cache entries in the background', async () => {
    const staleValue = JSON.stringify({ value: 'stale' })
    const nowSec = Math.floor(Date.now() / 1000)

    const first = vi.fn().mockResolvedValue({ value: staleValue, expires_at: nowSec - 10 })
    const bindSelect = vi.fn().mockReturnValue({ first })

    const runSet = vi.fn().mockResolvedValue({ meta: { changes: 1 } })
    const bindSet = vi.fn().mockReturnValue({ run: runSet })

    const prepare = vi.fn((sql: string) => {
      if (sql.startsWith('SELECT value, expires_at FROM kv_cache')) {
        return { bind: bindSelect }
      }
      if (sql.startsWith('INSERT OR REPLACE INTO kv_cache')) {
        return { bind: bindSet }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    })

    const waitUntil = vi.fn()
    const fetcher = vi.fn().mockResolvedValue({ value: 'fresh' })
    const event = {
      context: {
        cloudflare: {
          env: { DB: { prepare } },
          ctx: { waitUntil },
        },
      },
    } as never

    const result = await withD1Cache(event, 'test-key', 300, fetcher, false, {
      staleWindowSeconds: 60,
      returnMeta: true,
    })

    expect(result).toEqual({
      data: { value: 'stale' },
      _meta: expect.objectContaining({ stale: true }),
    })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(waitUntil).toHaveBeenCalledOnce()

    const refreshPromise = waitUntil.mock.calls[0]?.[0]
    expect(refreshPromise).toBeInstanceOf(Promise)
    await refreshPromise

    expect(bindSet).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify({ value: 'fresh' }),
      nowSec + 300,
    )
    expect(runSet).toHaveBeenCalledOnce()
  })
})

describe('cleanExpiredCache', () => {
  it('returns 0 when D1 is not available', async () => {
    const event = { context: {} } as never
    const result = await cleanExpiredCache(event)
    expect(result).toBe(0)
  })
})

describe('deleteD1CacheKeys', () => {
  it('deletes each requested key when D1 is available', async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } })
    const bind = vi.fn().mockReturnValue({ run })
    const prepare = vi.fn().mockReturnValue({ bind })
    const event = {
      context: {
        cloudflare: {
          env: { DB: { prepare } },
        },
      },
    } as never

    const deleted = await deleteD1CacheKeys(event, ['fleet-apps-list', 'fleet-apps-list-all'])

    expect(deleted).toBe(2)
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(bind).toHaveBeenNthCalledWith(1, 'fleet-apps-list')
    expect(bind).toHaveBeenNthCalledWith(2, 'fleet-apps-list-all')
  })
})
