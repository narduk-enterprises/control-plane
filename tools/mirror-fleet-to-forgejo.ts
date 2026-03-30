#!/usr/bin/env -S pnpm exec tsx

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from './command'
import {
  buildForgejoBasicAuthHeader,
  buildForgejoRepoUrl,
  ensureForgejoRepo,
  getForgejoBaseUrl,
  getForgejoOwner,
  getForgejoUsername,
} from '../apps/web/server/utils/provision-forgejo'

interface FleetSyncManifest {
  repos?: string[]
}

interface CliOptions {
  dryRun: boolean
  repoNames: string[]
  githubRepo: string | null
  forgejoRepo: string | null
}

function parseCommaList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseArgs(argv: string[]): CliOptions {
  const repoNames = parseCommaList(
    argv.find((arg) => arg.startsWith('--repos='))?.slice('--repos='.length),
  )
  const repoName = argv.find((arg) => arg.startsWith('--repo='))?.slice('--repo='.length)
  if (repoName) {
    repoNames.push(repoName)
  }

  return {
    dryRun: argv.includes('--dry-run'),
    repoNames: [...new Set(repoNames)],
    githubRepo: argv.find((arg) => arg.startsWith('--github-repo='))?.slice('--github-repo='.length) || null,
    forgejoRepo:
      argv.find((arg) => arg.startsWith('--forgejo-repo='))?.slice('--forgejo-repo='.length) ||
      null,
  }
}

function splitRepoSlug(repoSlug: string): { owner: string; name: string } {
  const [owner, name, ...rest] = repoSlug.split('/')
  if (!owner || !name || rest.length > 0) {
    throw new Error(`Invalid repo slug: ${repoSlug}`)
  }

  return { owner, name }
}

function readFleetRepos(): string[] {
  const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const manifestPath = resolve(rootDir, 'config/fleet-sync-repos.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as FleetSyncManifest
  return [...new Set((manifest.repos ?? []).map((repo) => repo.trim()).filter(Boolean))].sort()
}

function runGit(args: string[]): void {
  runCommand('git', args, {
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function mirrorRepository(sourceUrl: string, targetUrl: string, authHeader: string): void {
  const tempRoot = mkdtempSync(join(tmpdir(), 'control-plane-forgejo-mirror-'))
  const mirrorDir = join(tempRoot, 'mirror.git')

  try {
    runGit(['clone', '--mirror', sourceUrl, mirrorDir])
    runGit([
      '-c',
      `http.extraHeader=${authHeader}`,
      '--git-dir',
      mirrorDir,
      'push',
      '--mirror',
      targetUrl,
    ])
  } finally {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

async function mirrorOneRepo(
  githubRepo: string,
  forgejoRepo: string,
  options: { dryRun: boolean; githubToken: string; forgejoToken: string },
): Promise<void> {
  const { name } = splitRepoSlug(forgejoRepo)
  const forgejoBaseUrl = getForgejoBaseUrl(process.env.FLEET_FORGEJO_BASE_URL)
  const forgejoOwner = splitRepoSlug(forgejoRepo).owner
  const githubSourceUrl = `https://x-access-token:${options.githubToken}@github.com/${githubRepo}.git`
  const forgejoTargetUrl = `${buildForgejoRepoUrl(name, {
    baseUrl: forgejoBaseUrl,
    owner: forgejoOwner,
  })}.git`

  console.log(`[${name}] GitHub source: ${githubRepo}`)
  console.log(`[${name}] Forgejo target: ${forgejoRepo}`)

  if (options.dryRun) {
    console.log(`[${name}] DRY RUN: ensure Forgejo repo ${forgejoRepo}`)
    console.log(`[${name}] DRY RUN: git clone --mirror ${githubRepo}`)
    console.log(`[${name}] DRY RUN: git push --mirror ${forgejoRepo}`)
    return
  }

  const repoState = await ensureForgejoRepo(options.forgejoToken, name, {
    owner: forgejoOwner,
    baseUrl: forgejoBaseUrl,
  })
  if (repoState === 'created') {
    console.log(`[${name}] Created Forgejo repo ${forgejoRepo}`)
  }

  const forgejoUsername = await getForgejoUsername(options.forgejoToken, {
    baseUrl: forgejoBaseUrl,
  })
  const authHeader = buildForgejoBasicAuthHeader(forgejoUsername, options.forgejoToken)
  mirrorRepository(githubSourceUrl, forgejoTargetUrl, authHeader)
  console.log(`[${name}] Mirrored GitHub refs to Forgejo`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const githubToken = process.env.GH_SERVICE_TOKEN || process.env.CONTROL_PLANE_GH_SERVICE_TOKEN
  const forgejoToken = process.env.FORGEJO_TOKEN
  const githubOwner = process.env.GITHUB_OWNER || 'narduk-enterprises'
  const forgejoOwner = getForgejoOwner(process.env.FLEET_FORGEJO_OWNER || 'narduk-enterprises')

  if (!githubToken) {
    throw new Error('GH_SERVICE_TOKEN or CONTROL_PLANE_GH_SERVICE_TOKEN is required.')
  }
  if (!forgejoToken && !options.dryRun) {
    throw new Error('FORGEJO_TOKEN is required unless --dry-run is used.')
  }

  const explicitGithubRepo = options.githubRepo?.trim()
  const explicitForgejoRepo = options.forgejoRepo?.trim()
  const targets =
    explicitGithubRepo && explicitForgejoRepo
      ? [
          {
            githubRepo: explicitGithubRepo,
            forgejoRepo: explicitForgejoRepo,
          },
        ]
      : (options.repoNames.length > 0 ? options.repoNames : readFleetRepos()).map((repoName) => ({
          githubRepo: `${githubOwner}/${repoName}`,
          forgejoRepo: `${forgejoOwner}/${repoName}`,
        }))

  let failed = false
  for (const target of targets) {
    try {
      await mirrorOneRepo(target.githubRepo, target.forgejoRepo, {
        dryRun: options.dryRun,
        githubToken,
        forgejoToken: forgejoToken || '',
      })
    } catch (error) {
      failed = true
      console.error(
        `[${target.githubRepo}] Mirror failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (failed) {
    process.exitCode = 1
  }
}

void main()
