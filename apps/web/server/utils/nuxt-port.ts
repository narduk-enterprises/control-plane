const MIN_PORT = 1024
const MAX_PORT = 65535

export const DEFAULT_NUXT_PORT = 3000
export const FLEET_NUXT_PORT_START = 3200
export const FLEET_NUXT_PORT_END = 6199

export function normalizeNuxtPort(value: unknown): number | null {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_PORT &&
    value <= MAX_PORT
  ) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null

    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isInteger(parsed) && parsed >= MIN_PORT && parsed <= MAX_PORT) {
      return parsed
    }
  }

  return null
}

export function buildLocalNuxtUrl(port: number): string {
  return `http://localhost:${port}`
}

export interface NuxtPortAssignmentTarget {
  name: string
  nuxtPort?: unknown
}

export function allocateFleetNuxtPort(
  usedPorts: Iterable<unknown>,
  preferredPort?: unknown,
): number {
  const normalizedUsedPorts = new Set<number>()

  for (const value of usedPorts) {
    const port = normalizeNuxtPort(value)
    if (port !== null) normalizedUsedPorts.add(port)
  }

  const preferred = normalizeNuxtPort(preferredPort)
  if (preferred !== null && !normalizedUsedPorts.has(preferred)) {
    return preferred
  }

  for (let port = FLEET_NUXT_PORT_START; port <= FLEET_NUXT_PORT_END; port++) {
    if (!normalizedUsedPorts.has(port)) {
      return port
    }
  }

  throw new Error(
    `No free NUXT_PORT values remain in ${FLEET_NUXT_PORT_START}-${FLEET_NUXT_PORT_END}.`,
  )
}

export function deriveSeedNuxtPort(index: number): number {
  return FLEET_NUXT_PORT_START + index
}

export function assignMissingFleetNuxtPorts(
  apps: Iterable<NuxtPortAssignmentTarget>,
): Array<{ name: string; nuxtPort: number }> {
  const normalizedApps = Array.from(apps, (app) => ({
    name: app.name,
    nuxtPort: normalizeNuxtPort(app.nuxtPort),
  }))

  const usedPorts = normalizedApps
    .map((app) => app.nuxtPort)
    .filter((port): port is number => port !== null)

  const assignments: Array<{ name: string; nuxtPort: number }> = []
  const missingApps = normalizedApps
    .filter((app) => app.nuxtPort === null)
    .sort((left, right) => left.name.localeCompare(right.name))

  for (const app of missingApps) {
    const nuxtPort = allocateFleetNuxtPort(usedPorts)
    usedPorts.push(nuxtPort)
    assignments.push({ name: app.name, nuxtPort })
  }

  return assignments
}
