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
  name: string;
  url: string;
  dopplerProject: string;
  gaPropertyId?: string;
  posthogAppName?: string;
}

/** Production URLs per Doppler project. Sourced from each app's wrangler.json routes (custom_domain) in ~/new-code. */
const KNOWN_URLS: Record<string, string> = {
  'austin-texas-net': 'https://austin-texas.net',
  'circuit-breaker-online': 'https://circuitbreaker.online',
  clawdle: 'https://clawdle.nard.uk',
  'drift-map': 'https://drift-map.nard.uk',
  'enigma-box': 'https://enigma-box.nard.uk',
  'flashcard-pro': 'https://flashcard-pro.nard.uk',
  'imessage-dictionary': 'https://dictionary.nard.uk',
  nagolnagemluapleira: 'https://nagolnagemluapleira.nard.uk',
  'narduk-enterprises-portfolio': 'https://portfolio.nard.uk',
  'neon-sewer-raid': 'https://neon-sewer-raid.nard.uk',
  'ogpreview-app': 'https://ogpreview.app',
  'old-austin-grouch': 'https://grouch.austin-texas.net',
  'papa-everetts-pizza': 'https://papaeverettspizza.com',
  'sailing-passage-map': 'https://passages.nard.uk',
  'tiny-invoice': 'https://tiny-invoice.nard.uk',
  'video-grab': 'https://video-grab.nard.uk',
};

const KNOWN_GA_PROPERTIES: Record<string, string> = {
  'austin-texas-net': '526067189',
  'circuit-breaker-online': '520350533',
  clawdle: '526225128',
  'drift-map': '526978811',
  'enigma-box': '526992343',
  'flashcard-pro': '526595766',
  'imessage-dictionary': '526234707',
  nagolnagemluapleira: '526231074',
  'narduk-enterprises-portfolio': '526233051',
  'neon-sewer-raid': '526228839',
  'ogpreview-app': '526214794',
  'old-austin-grouch': '526226582',
  'papa-everetts-pizza': '526158939',
  'sailing-passage-map': '526974566',
  'tiny-invoice': '526997389',
  'video-grab': '526953881',
};

/** PostHog app proper names if they differ from the name/dopplerProject slug */
const KNOWN_POSTHOG_APPS: Record<string, string> = {
  'papa-everetts-pizza': "Papa Everett's Pizza Co.",
  'drift-map': 'Drift Map',
};

const FLEET_PROJECTS = [
  'austin-texas-net',
  'circuit-breaker-online',
  'clawdle',
  'drift-map',
  'enigma-box',
  'flashcard-pro',
  'imessage-dictionary',
  'nagolnagemluapleira',
  'narduk-enterprises-portfolio',
  'neon-sewer-raid',
  'ogpreview-app',
  'old-austin-grouch',
  'papa-everetts-pizza',
  'sailing-passage-map',
  'tiny-invoice',
  'video-grab',
] as const;

export function getFleetApps(): FleetApp[] {
  return FLEET_PROJECTS.map((dopplerProject) => ({
    name: dopplerProject,
    url: KNOWN_URLS[dopplerProject] ?? `https://${dopplerProject}.nard.uk`,
    dopplerProject,
    gaPropertyId: KNOWN_GA_PROPERTIES[dopplerProject],
    posthogAppName: KNOWN_POSTHOG_APPS[dopplerProject],
  }));
}

export function getFleetAppByName(name: string): FleetApp | undefined {
  return getFleetApps().find((app) => app.name === name);
}
