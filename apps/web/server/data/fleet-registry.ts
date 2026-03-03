/**
 * Single source of truth for narduk-enterprises fleet apps.
 *
 * How URLs are populated:
 * - Production URLs are set in KNOWN_URLS (sourced from each app's wrangler.json routes in ~/new-code).
 * - Keep KNOWN_URLS in sync with .agents/app-standardization/analytics-architecture.md
 *   and each app's Doppler SITE_URL (prd): doppler secrets get SITE_URL --project <name> --config prd
 * - Any app in FLEET_PROJECTS not in KNOWN_URLS gets fallback: https://${dopplerProject}.nard.uk
 *
 * Fleet production domains use [app-name].nard.uk (or a custom domain in KNOWN_URLS).
 *
 * Sources: .github/workflows/template-sync-bot.yml (matrix.repo), tools/validate-fleet-doppler.ts
 */
export interface FleetApp {
  name: string
  url: string
  dopplerProject: string
}

/** Production URLs per Doppler project. Sourced from each app's wrangler.json routes (custom_domain) in ~/new-code. */
const KNOWN_URLS: Record<string, string> = {
  clawdle: 'https://clawdle.nard.uk',
  'flashcard-pro': 'https://flashcard-pro.nard.uk',
  'narduk-enterprises-portfolio': 'https://portfolio.nard.uk',
  'papa-everetts-pizza': 'https://papaeverettspizza.com',
  'ogpreview-app': 'https://ogpreview.app',
  'old-austin-grouch': 'https://grouch.austin-texas.net',
  'neon-sewer-raid': 'https://neon-sewer-raid.nard.uk',
  'imessage-dictionary': 'https://dictionary.nard.uk',
  nagolnagemluapleira: 'https://nagolnagemluapleira.nard.uk',
  'drift-map': 'https://drift-map.nard.uk',
  'tiny-invoice': 'https://tiny-invoice.nard.uk',
  'enigma-box': 'https://enigma-box.nard.uk',
  'austin-texas-net': 'https://austin-texas.net',
  'circuit-breaker-online': 'https://circuitbreaker.online',
  'sailing-passage-map': 'https://passages.nard.uk',
  'video-grab': 'https://video-grab.nard.uk',
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
  'sailing-passage-map',
  'video-grab',
] as const

export function getFleetApps(): FleetApp[] {
  return FLEET_PROJECTS.map((dopplerProject) => ({
    name: dopplerProject,
    url: KNOWN_URLS[dopplerProject] ?? `https://${dopplerProject}.nard.uk`,
    dopplerProject,
  }))
}

export function getFleetAppByName(name: string): FleetApp | undefined {
  return getFleetApps().find((app) => app.name === name)
}
