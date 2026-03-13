import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { type ManagedRepo, getManagedRepos } from '../apps/web/server/data/managed-repos'

interface CliOptions {
  appsDir: string
  concurrency: number
  dryRun: boolean
  continueOnError: boolean
  includeInactive: boolean
  fromRepo: string | null
  repos: string[]
  exclude: Set<string>
}

interface DopplerSetup {
  path: string
  exists: boolean
  project: string | null
  config: string | null
}

const FLEET_DOPPLER_CONFIG = 'prd'

function parseListArg(name: string): string[] {
  const value = process.argv
    .slice(2)
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3)

  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const appsDirArg = args.find((arg) => arg.startsWith('--apps-dir='))?.slice('--apps-dir='.length)
  const concurrencyArg = args
    .find((arg) => arg.startsWith('--concurrency='))
    ?.slice('--concurrency='.length)
  const fromRepo = args.find((arg) => arg.startsWith('--from='))?.slice('--from='.length) ?? null
  const defaultAppsDir = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..', '..'))
  const concurrency = Number.parseInt(concurrencyArg ?? '4', 10)

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    console.error(`Invalid concurrency: ${concurrencyArg ?? ''}`)
    usage()
  }

  return {
    appsDir: resolve(appsDirArg ?? process.env.FLEET_APPS_DIR ?? defaultAppsDir),
    concurrency,
    dryRun: args.includes('--dry-run'),
    continueOnError: args.includes('--continue-on-error'),
    includeInactive: args.includes('--include-inactive'),
    fromRepo,
    repos: parseListArg('repos'),
    exclude: new Set(parseListArg('exclude')),
  }
}

function usage(): never {
  console.error('Usage: npx tsx tools/ship-fleet.ts [options]')
  console.error('  --repos=app1,app2        Only ship the listed repos')
  console.error('  --exclude=app1,app2      Skip the listed repos')
  console.error('  --from=<repo>            Start from this repo in catalog order')
  console.error('  --apps-dir=<path>        Override local fleet apps directory')
  console.error('  --concurrency=<n>        Number of concurrent pnpm ship runs (default: 4)')
  console.error('  --dry-run                Print planned commands without shipping')
  console.error('  --continue-on-error      Keep shipping after a failure')
  console.error('  --include-inactive       Include inactive repos from the catalog')
  process.exit(1)
}

function resolveTargets(options: CliOptions): ManagedRepo[] {
  const available = getManagedRepos()
    .filter((repo) => options.includeInactive || repo.isActive)
    .filter((repo) => repo.syncManaged)

  const requested = options.repos.length > 0 ? options.repos : available.map((repo) => repo.name)
  const unknown = requested.filter((repoName) => !available.some((repo) => repo.name === repoName))
  if (unknown.length > 0) {
    console.error(`Unknown fleet repos: ${unknown.join(', ')}`)
    process.exit(1)
  }

  let targets = available.filter(
    (repo) => requested.includes(repo.name) && !options.exclude.has(repo.name),
  )
  if (options.fromRepo) {
    const startIndex = targets.findIndex((repo) => repo.name === options.fromRepo)
    if (startIndex === -1) {
      console.error(`--from repo not found in target set: ${options.fromRepo}`)
      process.exit(1)
    }
    targets = targets.slice(startIndex)
  }

  if (targets.length === 0) {
    console.error('No fleet repos selected.')
    process.exit(1)
  }

  return targets
}

function readDopplerSetup(repoDir: string): DopplerSetup {
  const dopplerYamlPath = join(repoDir, 'doppler.yaml')
  if (!existsSync(dopplerYamlPath)) {
    return {
      path: dopplerYamlPath,
      exists: false,
      project: null,
      config: null,
    }
  }

  const content = readFileSync(dopplerYamlPath, 'utf8')
  const project = content.match(/^\s*project:\s*(.+)\s*$/m)?.[1]?.trim() || null
  const config = content.match(/^\s*config:\s*(.+)\s*$/m)?.[1]?.trim() || null

  return {
    path: dopplerYamlPath,
    exists: true,
    project,
    config,
  }
}

function ensureDopplerYaml(repo: ManagedRepo, repoDir: string, dryRun: boolean) {
  const setup = readDopplerSetup(repoDir)
  const resolvedProject = repo.dopplerProject
  const needsRepair =
    !setup.exists || setup.project !== resolvedProject || setup.config !== FLEET_DOPPLER_CONFIG

  if (needsRepair) {
    const nextContent = `setup:\n  project: ${resolvedProject}\n  config: ${FLEET_DOPPLER_CONFIG}\n`
    const action = setup.exists ? 'REPAIR' : 'ADD'
    console.log(
      `[${repo.name}] ${action}: doppler.yaml (project=${resolvedProject}, config=${FLEET_DOPPLER_CONFIG})`,
    )

    if (!dryRun) {
      writeFileSync(setup.path, nextContent, 'utf8')
    }
  } else {
    console.log(
      `[${repo.name}] doppler.yaml present (project=${setup.project}, config=${setup.config})`,
    )
  }

  return {
    project: resolvedProject,
    config: FLEET_DOPPLER_CONFIG,
  }
}

function prefixStream(
  repoName: string,
  stream: NodeJS.ReadableStream | null,
  writer: typeof console.log,
) {
  if (!stream) return

  const reader = createInterface({ input: stream })
  reader.on('line', (line) => writer(`[${repoName}] ${line}`))
}

function runShip(repo: ManagedRepo, repoDir: string, dryRun: boolean): Promise<number> {
  console.log(`\n=== ${repo.name} ===`)
  console.log(`[${repo.name}] dir: ${repoDir}`)

  if (!existsSync(repoDir)) {
    console.error(`[${repo.name}] Missing local clone.`)
    return Promise.resolve(2)
  }

  if (!existsSync(join(repoDir, 'package.json'))) {
    console.error(`[${repo.name}] Missing package.json.`)
    return Promise.resolve(2)
  }

  const doppler = ensureDopplerYaml(repo, repoDir, dryRun)

  if (dryRun) {
    console.log(
      `[${repo.name}] DRY RUN: DOPPLER_PROJECT=${doppler.project} DOPPLER_CONFIG=${doppler.config} pnpm ship`,
    )
    return Promise.resolve(0)
  }

  return new Promise((resolveExitCode) => {
    const child = spawn('pnpm', ['ship'], {
      cwd: repoDir,
      env: {
        ...process.env,
        DOPPLER_CONFIG: doppler.config,
        DOPPLER_PROJECT: doppler.project,
        FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
      },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    prefixStream(repo.name, child.stdout, console.log)
    prefixStream(repo.name, child.stderr, console.error)

    child.on('error', (error) => {
      console.error(`[${repo.name}] Failed to start pnpm ship: ${error.message}`)
      resolveExitCode(1)
    })

    child.on('close', (code, signal) => {
      if (signal) {
        console.error(`[${repo.name}] pnpm ship exited from signal ${signal}`)
        resolveExitCode(1)
        return
      }

      resolveExitCode(code ?? 1)
    })
  })
}

async function runTargets(targets: ManagedRepo[], options: CliOptions) {
  const succeeded = new Set<string>()
  const failed = new Set<string>()
  const concurrency = Math.min(options.concurrency, targets.length)
  let nextIndex = 0
  let stopScheduling = false

  async function worker() {
    while (true) {
      if (stopScheduling && !options.continueOnError) return

      const repo = targets[nextIndex]
      nextIndex += 1

      if (!repo) return

      const repoDir = join(options.appsDir, repo.name)
      const exitCode = await runShip(repo, repoDir, options.dryRun)

      if (exitCode === 0) {
        succeeded.add(repo.name)
        continue
      }

      failed.add(repo.name)
      console.error(`Failed: ${repo.name} (exit ${exitCode})`)
      if (!options.continueOnError) {
        stopScheduling = true
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return {
    succeeded: targets.map((repo) => repo.name).filter((repoName) => succeeded.has(repoName)),
    failed: targets.map((repo) => repo.name).filter((repoName) => failed.has(repoName)),
  }
}

async function main() {
  const options = parseArgs()
  if (process.argv.slice(2).includes('--help')) usage()

  const targets = resolveTargets(options)

  console.log('')
  console.log('Fleet Ship')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`Apps dir: ${options.appsDir}`)
  console.log(`Targets:  ${targets.map((repo) => repo.name).join(', ')}`)
  console.log(`Parallel: ${Math.min(options.concurrency, targets.length)}`)
  if (options.dryRun) console.log('Mode:     dry run')
  if (options.continueOnError) console.log('Policy:   continue on error')
  console.log('')

  const { succeeded, failed } = await runTargets(targets, options)

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log(`Succeeded: ${succeeded.length}`)
  console.log(`Failed:    ${failed.length}`)
  if (failed.length > 0) {
    console.log(`Failed repos: ${failed.join(', ')}`)
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
