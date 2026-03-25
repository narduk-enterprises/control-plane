import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runCommand } from './command'

function run(command: string, args: string[] = [], cwd = process.cwd()) {
  console.log(`\n> ${command} ${args.join(' ')}`.trim())
  runCommand(command, args, { stdio: 'inherit', cwd })
}

function tokenizeCommand(command: string): string[] {
  const tokens = command.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s"']+)/g)
  if (!tokens) return []

  return tokens.map((token) => {
    if (token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1)
    }
    if (token.startsWith("'") && token.endsWith("'")) {
      return token.slice(1, -1)
    }
    return token
  })
}

function parseMigrateCommand(rawCommand: string): string[] {
  if (/[;&|`$<>]/.test(rawCommand)) {
    throw new Error(`Unsafe db:migrate script: ${rawCommand}`)
  }

  const tokens = tokenizeCommand(rawCommand)
  if (tokens.length === 0) {
    throw new Error('Empty db:migrate script.')
  }

  return tokens
}


async function shipApp(appTarget: string) {
  // Find target directory
  let appDir = resolve(process.cwd(), 'apps', appTarget)
  if (!existsSync(appDir)) {
    appDir = resolve(process.cwd(), 'packages', appTarget)
    if (!existsSync(appDir)) {
      console.error(`❌ Target directory for ${appTarget} does not exist in apps/ or packages/`)
      process.exit(1)
    }
  }

  const pkgPath = resolve(appDir, 'package.json')
  let hasMigrate = false
  let pkg
  if (existsSync(pkgPath)) {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    if (pkg.scripts && pkg.scripts['db:migrate']) {
      hasMigrate = true
    }
  }

  // 1. Build Verification
  console.log(`\n🏗️ Building ${appTarget}...`)
  try {
    run('doppler', ['run', '--', 'pnpm', 'run', 'build'], appDir)
  } catch (error) {
    console.error(`\n❌ Build failed for ${appTarget}. Aborting ship to prevent broken commit.`)
    process.exit(1)
  }

  // 2. Git operations
  console.log(`\n📦 Checking git status...`)
  run('git', ['add', '-A'], appDir)

  let hasChanges = false
  try {
    runCommand('git', ['diff', '--cached', '--quiet'], { cwd: appDir })
  } catch (e) {
    hasChanges = true
  }

  if (hasChanges) {
    const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    run('git', ['commit', '-m', `chore: ship ${date}`], appDir)
  } else {
    console.log('No changes to commit.')
  }

  console.log(`\n🔄 Fetching remote...`)
  run('git', ['fetch'], appDir)
  try {
    runCommand('git', ['merge-base', '--is-ancestor', '@{u}', 'HEAD'], { cwd: appDir })
  } catch (e) {
    console.error(
      '\n❌ Remote has changes not in local branch. Run: git pull --rebase && pnpm ship\n',
    )
    process.exit(1)
  }

  console.log(`\n🚀 Pushing to remote...`)
  run('git', ['push'], appDir)

  // 3. Remote Migrations
  if (hasMigrate && pkg) {
    console.log(`\n🗄️ Running remote D1 migrations for ${appTarget}...`)
    const migrateCmd = pkg.scripts['db:migrate'].replaceAll('--local', '--remote')
    const migrateArgs = parseMigrateCommand(migrateCmd)
    run('doppler', ['run', '--', ...migrateArgs], appDir)
  }

  // 4. Deploy
  console.log(`\n☁️ Deploying ${appTarget} to Edge...`)
  try {
    run('doppler', ['run', '--', 'pnpm', 'run', 'deploy'], appDir)
  } catch (error) {
    console.error(`\n❌ Deploy failed for ${appTarget}.`)
    process.exit(1)
  }

  console.log(`\n📡 Control-plane fleet metadata is managed centrally; skipping ship-time registry mutation.`)

  console.log(`\n🎉 Successfully shipped ${appTarget}!`)
}

async function main() {
  const args = process.argv.slice(2)
  const targetArg = args[0] || 'web' // default to web target

  let targets = [targetArg]

  if (targetArg.includes(',')) {
    targets = targetArg.split(',').map((t) => t.trim())
  }

  for (const target of targets) {
    console.log(`\n======================================================`)
    console.log(`🚀 INITIATING SHIP SEQUENCE FOR: ${target}`)
    console.log(`======================================================\n`)
    await shipApp(target)
  }
}

main()
