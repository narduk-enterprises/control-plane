/**
 * Sync Doppler config `copilot` → GitHub Actions environment `copilot` secrets.
 *
 * Use a dedicated Doppler config (e.g. `copilot`) on the app project with only
 * keys the GitHub Copilot coding agent needs (registry token, optional Cloudflare, etc.).
 *
 * Usage:
 *   pnpm run sync:copilot-secrets -- reminders
 *   pnpm run sync:copilot-secrets -- reminders --dry-run
 *   pnpm run sync:copilot-secrets -- reminders --org my-org --github-repo my-org/reminders
 *
 * If --doppler-config is omitted, tries copilot → prd_copilot → dev_copilot (fleet projects
 * that require prd_/dev_ config name prefixes should use prd_copilot or pass --doppler-config).
 *
 * Requires: doppler CLI (authenticated), gh CLI (authenticated with permission to
 * set environment secrets on the target repo).
 *
 * GitHub forbids secret names starting with GITHUB_. This tool renames those to GH_*
 * when pushing (e.g. GITHUB_TOKEN_PACKAGES_READ → GH_TOKEN_PACKAGES_READ). Use the
 * GH_* name in copilot workflow env.
 */

import { spawnSync } from 'node:child_process'
import { runCommand } from './command'

/** Doppler keys to sync by default (agent install + optional Cloudflare checks). */
const MINIMAL_COPILOT_DOPPLER_KEYS = new Set([
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'PACKAGE_REGISTRY_PROVIDER',
  'FLEET_FORGEJO_BASE_URL',
  'FLEET_FORGEJO_OWNER',
  'GITHUB_TOKEN_PACKAGES_READ',
  'FORGEJO_TOKEN',
  'NODE_AUTH_TOKEN',
])

function printUsage(): void {
  console.error(`Usage:
  pnpm exec tsx tools/sync-copilot-secrets.ts <doppler-project-slug> [options]

GitHub repo defaults to narduk-enterprises/<slug>.

Options:
  --org=ORG                 GitHub owner/org (default: narduk-enterprises)
  --github-repo=OWNER/REPO  Override full repo (overrides org + slug)
  --doppler-config=NAME     Doppler config (omit to try copilot, then prd_copilot, then dev_copilot)
  --env=NAME                GitHub environment name (default: copilot)
  --all-secrets             Sync every Doppler key (still renames GITHUB_*); default is minimal agent set only
  --dry-run                 List keys only, do not call gh
`)
}

function parseArgs(argv: string[]): {
  slug: string | null
  org: string
  githubRepo: string | null
  dopplerConfig: string | undefined
  ghEnv: string
  dryRun: boolean
  allSecrets: boolean
} {
  let org = 'narduk-enterprises'
  let githubRepo: string | null = null
  let dopplerConfig: string | undefined
  let ghEnv = 'copilot'
  let dryRun = false
  let allSecrets = false
  const positional: string[] = []
  for (const a of argv) {
    if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(0)
    }
    if (a === '--dry-run') {
      dryRun = true
      continue
    }
    if (a === '--all-secrets') {
      allSecrets = true
      continue
    }
    if (a.startsWith('--org=')) {
      org = a.slice('--org='.length)
      continue
    }
    if (a.startsWith('--github-repo=')) {
      githubRepo = a.slice('--github-repo='.length)
      continue
    }
    if (a.startsWith('--doppler-config=')) {
      dopplerConfig = a.slice('--doppler-config='.length)
      continue
    }
    if (a.startsWith('--env=')) {
      ghEnv = a.slice('--env='.length)
      continue
    }
    if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`)
      printUsage()
      process.exit(1)
    }
    positional.push(a)
  }
  const slug = positional[0] ?? null
  return { slug, org, githubRepo, dopplerConfig, ghEnv, dryRun, allSecrets }
}

/** GitHub Actions rejects names starting with GITHUB_. */
function githubEnvSecretName(dopplerKey: string): string {
  if (dopplerKey.startsWith('GITHUB_')) {
    return `GH_${dopplerKey.slice('GITHUB_'.length)}`
  }
  return dopplerKey
}

function requireCli(name: string, checkArgs: string[]): void {
  try {
    runCommand(name, checkArgs, { stdio: 'pipe' })
  } catch {
    console.error(`❌ ${name} not found or not working. Install and authenticate ${name} first.`)
    process.exit(1)
  }
}

function dopplerDownloadJson(project: string, config: string): Record<string, string> {
  const raw = runCommand(
    'doppler',
    ['secrets', 'download', '--no-file', '--format', 'json', '-p', project, '-c', config],
    { stdio: 'pipe' },
  )
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed ?? {})) {
    if (typeof v === 'string') {
      out[k] = v
    } else if (v !== null && typeof v === 'object' && 'computed' in v) {
      const computed = (v as { computed?: string }).computed
      if (typeof computed === 'string') {
        out[k] = computed
      }
    }
  }
  return out
}

const DOPPLER_CONFIG_FALLBACKS = ['copilot', 'prd_copilot', 'dev_copilot'] as const

function resolveDopplerSecrets(
  project: string,
  explicitConfig: string | undefined,
): { config: string; secrets: Record<string, string> } {
  const candidates = explicitConfig ? [explicitConfig] : [...DOPPLER_CONFIG_FALLBACKS]
  let lastError: unknown
  for (const candidate of candidates) {
    try {
      const secrets = dopplerDownloadJson(project, candidate)
      return { config: candidate, secrets }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function ensureGitHubEnvironment(repo: string, envName: string): void {
  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    console.error('❌ Repo must be OWNER/REPO')
    process.exit(1)
  }

  const path = `repos/${owner}/${repoName}/environments/${envName}`
  const result = spawnSync('gh', ['api', '-X', 'PUT', path, '--input', '-'], {
    input: '{}',
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
  })

  if (result.status !== 0) {
    const error = (result.stderr || result.stdout || '').toString().trim()
    console.error(`❌ Failed to ensure GitHub environment "${envName}": ${error}`)
    process.exit(1)
  }
}

function ghSecretSet(repo: string, envName: string, secretName: string, value: string): void {
  const result = spawnSync('gh', ['secret', 'set', secretName, '--repo', repo, '--env', envName], {
    input: value,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })

  if (result.status !== 0) {
    const error = (result.stderr || result.stdout || '').toString().trim()
    console.error(`❌ gh secret set ${secretName} failed: ${error}`)
    process.exit(1)
  }
}

function main(): void {
  const argv = process.argv.slice(2).filter((arg) => arg !== '--')
  const { slug, org, githubRepo, dopplerConfig, ghEnv, dryRun, allSecrets } = parseArgs(argv)

  if (!slug) {
    printUsage()
    process.exit(1)
  }

  const repo = githubRepo ?? `${org}/${slug}`

  requireCli('doppler', ['--version'])
  requireCli('gh', ['--version'])

  console.log(`📌 GitHub repo: ${repo} / environment: ${ghEnv}`)

  let secrets: Record<string, string>
  let resolvedDopplerConfig: string
  try {
    const resolved = resolveDopplerSecrets(slug, dopplerConfig)
    secrets = resolved.secrets
    resolvedDopplerConfig = resolved.config
  } catch (error: unknown) {
    const hint = dopplerConfig
      ? `Does Doppler config "${dopplerConfig}" exist on project "${slug}"?`
      : `Tried ${DOPPLER_CONFIG_FALLBACKS.join(', ')} on project "${slug}". Create one (e.g. prd_copilot under Production) and add agent-only keys.`
    console.error(`❌ Doppler download failed. ${hint}`)
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }

  console.log(`📦 Doppler project: ${slug} / config: ${resolvedDopplerConfig}`)

  let keys = Object.keys(secrets).filter((key) => !key.startsWith('DOPPLER_'))
  if (!allSecrets) {
    keys = keys.filter((key) => MINIMAL_COPILOT_DOPPLER_KEYS.has(key))
  }
  if (keys.length === 0) {
    console.error(
      allSecrets
        ? '❌ No secrets found in Doppler (after filtering).'
        : `❌ No minimal agent secrets in Doppler. Expected at least one of: ${[...MINIMAL_COPILOT_DOPPLER_KEYS].sort().join(', ')}. Use --all-secrets to sync the full config.`,
    )
    process.exit(1)
  }

  const pairs = keys.sort().map((dopplerKey) => ({
    dopplerKey,
    githubKey: githubEnvSecretName(dopplerKey),
    value: secrets[dopplerKey],
  }))

  const summary = pairs.map((pair) => `${pair.dopplerKey}→${pair.githubKey}`).join(', ')
  console.log(
    `${dryRun ? '🔍' : '⬆️'} ${pairs.length} secret(s) (${allSecrets ? 'all' : 'minimal'}): ${summary}`,
  )

  if (dryRun) {
    console.log('✅ Dry run complete (no GitHub changes).')
    return
  }

  ensureGitHubEnvironment(repo, ghEnv)

  for (const { dopplerKey, githubKey, value } of pairs) {
    if (!value) {
      console.log(`  ⏭ skip ${dopplerKey} (empty)`)
      continue
    }
    const suffix = githubKey !== dopplerKey ? ` → ${githubKey}` : ''
    console.log(`  … ${dopplerKey}${suffix}`)
    ghSecretSet(repo, ghEnv, githubKey, value)
  }

  console.log('✅ Sync complete.')
}

main()
