/**
 * Single source of truth for narduk-enterprises fleet apps.
 * Sourced from .github/workflows/template-sync-bot.yml (matrix.repo),
 * tools/validate-fleet-doppler.ts (FLEET_PROJECTS), and
 * .agents/app-standardization/analytics-architecture.md (production URLs).
 */
export interface FleetApp {
  name: string
  url: string
  dopplerProject: string
}

const KNOWN_URLS: Record<string, string> = {
  clawdle: 'https://clawdle.com',
  'flashcard-pro': 'https://flashcard-pro.narduk.workers.dev',
  'narduk-enterprises-portfolio': 'https://portfolio.nard.uk',
  'papa-everetts-pizza': 'https://papaeverettspizza.com',
  'ogpreview-app': 'https://ogpreview.app',
  'old-austin-grouch': 'https://grouch.austin-texas.net',
  'neon-sewer-raid': 'https://neon-sewer-raid.narduk.workers.dev',
  'imessage-dictionary': 'https://dictionary.nard.uk',
  nagolnagemluapleira: 'https://nagolnagemluapleira.narduk.workers.dev',
  'drift-map': 'https://drift-map.narduk.workers.dev',
  'tiny-invoice': 'https://tiny-invoice.narduk.workers.dev',
  'enigma-box': 'https://enigma-box.narduk.workers.dev',
  'austin-texas-net': 'https://austin-texas.net',
}

const FLEET_PROJECTS = [
  'neon-sewer-raid',
  'old-austin-grouch',
  'ogpreview-app',
  'imessage-dictionary',
  'narduk-enterprises-portfolio',
  'drift-map',
  'tiny-invoice',
  'enigma-box',
  'papa-everetts-pizza',
  'flashcard-pro',
  'clawdle',
  'circuit-breaker-online',
  'nagolnagemluapleira',
  'austin-texas-net',
] as const

export function getFleetApps(): FleetApp[] {
  return FLEET_PROJECTS.map((dopplerProject) => ({
    name: dopplerProject,
    url: KNOWN_URLS[dopplerProject] ?? `https://${dopplerProject}.narduk.workers.dev`,
    dopplerProject,
  }))
}

export function getFleetAppByName(name: string): FleetApp | undefined {
  return getFleetApps().find((app) => app.name === name)
}
