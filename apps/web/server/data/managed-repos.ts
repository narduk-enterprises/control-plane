export interface ManagedRepo {
  name: string
  githubRepo: string
  dopplerProject: string
  publicUrl: string | null
  gaPropertyId: string | null
  gaMeasurementId: string | null
  posthogAppName: string | null
  syncManaged: boolean
  monitoringEnabled: boolean
  isActive: boolean
}

export const MANAGED_REPOS = [
  {
    name: 'ai-media-gen',
    githubRepo: 'narduk-enterprises/ai-media-gen',
    dopplerProject: 'ai-media-gen',
    publicUrl: 'https://ai-media-gen.nard.uk',
    gaPropertyId: null,
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'austin-texas-net',
    githubRepo: 'narduk-enterprises/austin-texas-net',
    dopplerProject: 'austin-texas-net',
    publicUrl: 'https://austin-texas.net',
    gaPropertyId: '526067189',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'circuit-breaker-online',
    githubRepo: 'narduk-enterprises/circuit-breaker-online',
    dopplerProject: 'circuit-breaker-online',
    publicUrl: 'https://circuitbreaker.online',
    gaPropertyId: '520350533',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'clawdle',
    githubRepo: 'narduk-enterprises/clawdle',
    dopplerProject: 'clawdle',
    publicUrl: 'https://clawdle.nard.uk',
    gaPropertyId: '526225128',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'control-plane',
    githubRepo: 'narduk-enterprises/control-plane',
    dopplerProject: 'control-plane',
    publicUrl: 'https://control-plane.nard.uk',
    gaPropertyId: null,
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'drift-map',
    githubRepo: 'narduk-enterprises/drift-map',
    dopplerProject: 'drift-map',
    publicUrl: 'https://drift-map.nard.uk',
    gaPropertyId: '526978811',
    gaMeasurementId: null,
    posthogAppName: 'Drift Map',
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'enigma-box',
    githubRepo: 'narduk-enterprises/enigma-box',
    dopplerProject: 'enigma-box',
    publicUrl: 'https://enigma-box.nard.uk',
    gaPropertyId: '526992343',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'favicon-checker',
    githubRepo: 'narduk-enterprises/favicon-checker',
    dopplerProject: 'favicon-checker',
    publicUrl: 'https://favicon-checker.nard.uk',
    gaPropertyId: null,
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'flashcard-pro',
    githubRepo: 'narduk-enterprises/flashcard-pro',
    dopplerProject: 'flashcard-pro',
    publicUrl: 'https://flashcard-pro.nard.uk',
    gaPropertyId: '526595766',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'imessage-dictionary',
    githubRepo: 'narduk-enterprises/imessage-dictionary',
    dopplerProject: 'imessage-dictionary',
    publicUrl: 'https://dictionary.nard.uk',
    gaPropertyId: '526234707',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'nagolnagemluapleira',
    githubRepo: 'narduk-enterprises/nagolnagemluapleira',
    dopplerProject: 'nagolnagemluapleira',
    publicUrl: 'https://nagolnagemluapleira.nard.uk',
    gaPropertyId: '526231074',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'narduk-enterprises-portfolio',
    githubRepo: 'narduk-enterprises/narduk-enterprises-portfolio',
    dopplerProject: 'narduk-enterprises-portfolio',
    publicUrl: 'https://portfolio.nard.uk',
    gaPropertyId: '526233051',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'neon-sewer-raid',
    githubRepo: 'narduk-enterprises/neon-sewer-raid',
    dopplerProject: 'neon-sewer-raid',
    publicUrl: 'https://neon-sewer-raid.nard.uk',
    gaPropertyId: '526228839',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'ogpreview-app',
    githubRepo: 'narduk-enterprises/ogpreview-app',
    dopplerProject: 'ogpreview-app',
    publicUrl: 'https://ogpreview.app',
    gaPropertyId: '526214794',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'old-austin-grouch',
    githubRepo: 'narduk-enterprises/old-austin-grouch',
    dopplerProject: 'old-austin-grouch',
    publicUrl: 'https://grouch.austin-texas.net',
    gaPropertyId: '526226582',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'papa-everetts-pizza',
    githubRepo: 'narduk-enterprises/papa-everetts-pizza',
    dopplerProject: 'papa-everetts-pizza',
    publicUrl: 'https://papaeverettspizza.com',
    gaPropertyId: '526158939',
    gaMeasurementId: null,
    posthogAppName: "Papa Everett's Pizza Co.",
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'sailing-passage-map',
    githubRepo: 'narduk-enterprises/sailing-passage-map',
    dopplerProject: 'sailing-passage-map',
    publicUrl: 'https://passages.nard.uk',
    gaPropertyId: '526974566',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'tide-check',
    githubRepo: 'narduk-enterprises/tide-check',
    dopplerProject: 'tide-check',
    publicUrl: 'https://tide-check.nard.uk',
    gaPropertyId: null,
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'tiny-invoice',
    githubRepo: 'narduk-enterprises/tiny-invoice',
    dopplerProject: 'tiny-invoice',
    publicUrl: 'https://tiny-invoice.nard.uk',
    gaPropertyId: '526997389',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
  {
    name: 'video-grab',
    githubRepo: 'narduk-enterprises/video-grab',
    dopplerProject: 'video-grab',
    publicUrl: 'https://video-grab.nard.uk',
    gaPropertyId: '526953881',
    gaMeasurementId: null,
    posthogAppName: null,
    syncManaged: true,
    monitoringEnabled: true,
    isActive: true,
  },
] satisfies readonly ManagedRepo[]

export interface PublicFleetApp {
  name: string
  url: string
  dopplerProject: string
  gaPropertyId: string | null
  gaMeasurementId: string | null
  posthogAppName: string | null
  githubRepo: string
  isActive: boolean
}

export function getManagedRepos(): ManagedRepo[] {
  return [...MANAGED_REPOS].sort((a, b) => a.name.localeCompare(b.name))
}

export function getSyncManagedRepos(): ManagedRepo[] {
  return getManagedRepos().filter((repo) => repo.isActive && repo.syncManaged)
}

export function getPublicFleetApps(): PublicFleetApp[] {
  return getManagedRepos()
    .filter(
      (repo): repo is ManagedRepo & { publicUrl: string } =>
        repo.isActive && repo.monitoringEnabled && Boolean(repo.publicUrl),
    )
    .map((repo) => ({
      name: repo.name,
      url: repo.publicUrl,
      dopplerProject: repo.dopplerProject,
      gaPropertyId: repo.gaPropertyId,
      gaMeasurementId: repo.gaMeasurementId,
      posthogAppName: repo.posthogAppName,
      githubRepo: repo.githubRepo,
      isActive: repo.isActive,
    }))
}
