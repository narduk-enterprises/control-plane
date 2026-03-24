import { describe, expect, it } from 'vitest'
import {
  allocateFleetNuxtPort,
  assignMissingFleetNuxtPorts,
  normalizeNuxtPort,
} from '../../server/utils/nuxt-port'

describe('nuxt-port', () => {
  it('normalizes valid values and rejects invalid ones', () => {
    expect(normalizeNuxtPort(3200)).toBe(3200)
    expect(normalizeNuxtPort('3201')).toBe(3201)
    expect(normalizeNuxtPort('')).toBeNull()
    expect(normalizeNuxtPort('abc')).toBeNull()
    expect(normalizeNuxtPort(80)).toBeNull()
  })

  it('allocates the next free fleet port when the preferred port is unavailable', () => {
    expect(allocateFleetNuxtPort([3200, 3201], 3201)).toBe(3202)
  })

  it('assigns missing fleet ports in stable name order', () => {
    expect(
      assignMissingFleetNuxtPorts([
        { name: 'zulu', nuxtPort: null },
        { name: 'alpha', nuxtPort: null },
        { name: 'bravo', nuxtPort: 3200 },
      ]),
    ).toEqual([
      { name: 'alpha', nuxtPort: 3201 },
      { name: 'zulu', nuxtPort: 3202 },
    ])
  })
})
