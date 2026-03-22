import { resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const nuxtConfigPath = resolve(import.meta.dirname, '../nuxt.config.ts')
const originalColorModePreference = process.env.NUXT_COLOR_MODE_PREFERENCE
type LayerNuxtConfig = {
  colorMode?: {
    preference?: string
    fallback?: string
  }
  icon?: {
    clientBundle?: unknown
    serverBundle?: unknown
  }
}

async function loadNuxtConfig() {
  const previousDefineNuxtConfig = (globalThis as { defineNuxtConfig?: unknown }).defineNuxtConfig
  ;(globalThis as { defineNuxtConfig?: (config: unknown) => unknown }).defineNuxtConfig = (
    config: unknown,
  ) => config

  try {
    vi.resetModules()
    return (await import(nuxtConfigPath)).default as LayerNuxtConfig
  } finally {
    if (previousDefineNuxtConfig) {
      ;(globalThis as { defineNuxtConfig?: unknown }).defineNuxtConfig = previousDefineNuxtConfig
    } else {
      delete (globalThis as { defineNuxtConfig?: unknown }).defineNuxtConfig
    }
  }
}

afterEach(() => {
  if (originalColorModePreference === undefined) {
    delete process.env.NUXT_COLOR_MODE_PREFERENCE
  } else {
    process.env.NUXT_COLOR_MODE_PREFERENCE = originalColorModePreference
  }
})

describe('layer nuxt config', () => {
  it('defaults color mode to dark for deterministic fleet rendering', async () => {
    delete process.env.NUXT_COLOR_MODE_PREFERENCE

    const config = await loadNuxtConfig()

    expect(config.colorMode).toMatchObject({
      preference: 'dark',
      fallback: 'dark',
    })
  })

  it('allows color mode preference override via env', async () => {
    process.env.NUXT_COLOR_MODE_PREFERENCE = 'light'

    const config = await loadNuxtConfig()

    expect(config.colorMode).toMatchObject({
      preference: 'light',
      fallback: 'dark',
    })
  })

  it('keeps icon rendering compatible with dynamic icon names', async () => {
    const config = await loadNuxtConfig()

    expect(config.icon?.clientBundle).toBeUndefined()
    expect(config.icon?.serverBundle).toEqual({
      collections: ['lucide'],
    })
  })
})
