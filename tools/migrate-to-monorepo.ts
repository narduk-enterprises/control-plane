/**
 * MIGRATE-TO-MONOREPO.TS — Restructure a flat Nuxt app into apps/web/ monorepo layout
 * ------------------------------------------------------------------------------------
 * Converts a derived app that has app/server/public at repo root into the standard
 * template structure: apps/web/, layers/narduk-nuxt-layer/, packages/eslint-config/.
 *
 * Usage (run from template repo):
 *   npx tsx tools/migrate-to-monorepo.ts <app-dir>
 *   npx tsx tools/migrate-to-monorepo.ts ~/new-code/imessage-dictionary --dry-run
 *
 * Options:
 *   --dry-run   Log what would be done without writing or running commands
 */

import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '..')

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const dryRun = process.argv.includes('--dry-run')
const appDir = args[0]?.replace(/^~/, process.env.HOME || '')
if (!appDir || !existsSync(appDir)) {
  console.error('Usage: npx tsx tools/migrate-to-monorepo.ts <app-dir> [--dry-run]')
  process.exit(1)
}

const appName = appDir.split('/').filter(Boolean).pop() || 'unknown'
const appsWeb = join(appDir, 'apps/web')

function run(cmd: string, opts: { cwd?: string } = {}) {
  if (dryRun) {
    console.log(`  [dry-run] ${cmd}`)
    return
  }
  execSync(cmd, { encoding: 'utf-8', stdio: 'inherit', cwd: opts.cwd || appDir })
}

function cpR(src: string, dest: string) {
  if (dryRun) {
    console.log(`  [dry-run] cp -R ${src} ${dest}`)
    return
  }
  execSync(`cp -R "${src}" "${dest}"`, { cwd: appDir })
}

function rmRf(p: string) {
  if (!existsSync(p)) return
  if (dryRun) {
    console.log(`  [dry-run] rm -rf ${p}`)
    return
  }
  rmSync(p, { recursive: true, force: true })
}

function ensureDir(p: string) {
  if (dryRun) return
  const dir = dirname(p)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Dependencies the layer already provides — do not duplicate in apps/web/package.json
const LAYER_PROVIDED_DEPS = new Set([
  '@nuxt/image',
  '@nuxt/ui',
  '@nuxtjs/seo',
  'drizzle-orm',
  'jose',
  'nuxt',
  'posthog-js',
  'tailwindcss',
  'vue',
  'vue-router',
  'zod',
])
const LAYER_PROVIDED_DEV_DEPS = new Set([
  '@cloudflare/workers-types',
  '@iconify-json/lucide',
  '@nuxt/eslint',
  '@nuxt/fonts',
  'drizzle-kit',
  'eslint',
  'eslint-config-prettier',
  'google-auth-library',
  'googleapis',
  'prettier',
  'typescript-eslint',
  'vue-eslint-parser',
])

function main() {
  console.log()
  console.log(`Migrate to monorepo: ${appName}${dryRun ? ' [DRY RUN]' : ''}`)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  App:      ${appDir}`)
  console.log(`  Template: ${TEMPLATE_DIR}`)
  console.log()

  // Step 1: Detect flat structure
  if (existsSync(join(appDir, 'apps'))) {
    console.error('  ❌ App already has apps/ directory. Not a flat layout.')
    process.exit(1)
  }
  if (!existsSync(join(appDir, 'nuxt.config.ts'))) {
    console.error('  ❌ No root nuxt.config.ts found.')
    process.exit(1)
  }
  console.log('  ✓ Flat structure detected.')
  console.log()

  // Step 2: Create skeleton
  console.log('Step 2: Creating apps/web, layers, packages...')
  if (!dryRun) {
    mkdirSync(join(appDir, 'apps/web'), { recursive: true })
    mkdirSync(join(appDir, 'layers'), { recursive: true })
    mkdirSync(join(appDir, 'packages'), { recursive: true })
  }
  console.log('  ✓ Directories ready.')
  console.log()

  // Step 3: Move app code into apps/web/
  console.log('Step 3: Moving app code into apps/web/...')
  const toMove = [
    'app',
    'server',
    'public',
    'drizzle',
    'nuxt.config.ts',
    'tsconfig.json',
    'wrangler.json',
    'eslint.config.mjs',
    'drizzle.config.ts',
  ]
  for (const name of toMove) {
    const src = join(appDir, name)
    const dest = join(appsWeb, name)
    if (existsSync(src)) {
      if (statSync(src).isDirectory()) {
        cpR(src, dest)
        rmRf(src)
      } else {
        if (!dryRun) {
          ensureDir(dest)
          copyFileSync(src, dest)
          rmSync(src)
        } else {
          console.log(`  [dry-run] mv ${name} → apps/web/`)
        }
      }
    }
  }
  const optionalDirs = ['content', 'scripts', 'types']
  for (const name of optionalDirs) {
    const src = join(appDir, name)
    if (existsSync(src)) {
      const dest = join(appsWeb, name)
      cpR(src, dest)
      rmRf(src)
    }
  }
  const optionalFiles = ['vitest.config.ts', 'content.config.ts', 'seo.config.ts']
  for (const name of optionalFiles) {
    const src = join(appDir, name)
    if (existsSync(src)) {
      if (!dryRun) {
        copyFileSync(src, join(appsWeb, name))
        rmSync(src)
      } else {
        console.log(`  [dry-run] mv ${name} → apps/web/`)
      }
    }
  }
  console.log('  ✓ App code moved.')
  console.log()

  // Step 3b: Remove layer-provided server files from apps/web (avoids duplicate lint/typecheck)
  const serverDir = join(appsWeb, 'server')
  const layerServerPaths = [
    'api/health.get.ts',
    'api/indexnow',
    'api/admin/ga',
    'api/admin/gsc',
    'api/admin/indexing',
    'middleware/d1.ts',
    'utils/database.ts',
    'utils/kv.ts',
    'utils/r2.ts',
    'utils/auth.ts',
    'utils/rateLimit.ts',
  ]
  for (const rel of layerServerPaths) {
    const p = join(serverDir, rel)
    if (existsSync(p)) rmRf(p)
  }
  console.log('  ✓ Layer-provided server paths removed from apps/web.')
  console.log()

  // Step 4: Create apps/web/package.json
  console.log('Step 4: Creating apps/web/package.json...')
  const rootPkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'))
  const wranglerPath = join(appsWeb, 'wrangler.json')
  let dbName = 'web-db'
  if (existsSync(wranglerPath)) {
    try {
      const wr = JSON.parse(readFileSync(wranglerPath, 'utf-8'))
      if (wr.d1_databases?.[0]?.database_name) dbName = wr.d1_databases[0].database_name
    } catch { /* ignore */ }
  }
  const templateWebPkg = JSON.parse(
    readFileSync(join(TEMPLATE_DIR, 'apps/web/package.json'), 'utf-8'),
  )
  const appDeps: Record<string, string> = {
    '@narduk-enterprises/narduk-nuxt-template-layer': 'workspace:*',
    '@narduk/eslint-config': 'workspace:*',
    'drizzle-orm': '^0.45.1',
    nuxt: '^4.3.1',
    zod: '^4.3.6',
  }
  const rootDeps = rootPkg.dependencies || {}
  for (const [k, v] of Object.entries(rootDeps)) {
    if (!LAYER_PROVIDED_DEPS.has(k)) (appDeps as Record<string, string>)[k] = v as string
  }
  const appDevDeps: Record<string, string> = {
    ...(templateWebPkg.devDependencies || {}),
  }
  const rootDev = rootPkg.devDependencies || {}
  for (const [k, v] of Object.entries(rootDev)) {
    if (!LAYER_PROVIDED_DEV_DEPS.has(k)) (appDevDeps as Record<string, string>)[k] = v as string
  }
  const webPkg = {
    name: 'web',
    type: 'module',
    private: true,
    version: rootPkg.version || '1.0.0',
    scripts: {
      build: 'nuxt build',
      dev: 'nuxt dev',
      'db:migrate': `wrangler d1 execute ${dbName} --local --file=drizzle/0000_initial_schema.sql`,
      'db:studio': 'drizzle-kit studio',
      generate: 'nuxt generate',
      preview: 'nuxt preview',
      typecheck: 'nuxt typecheck',
      deploy: 'nuxt build && wrangler deploy',
      prelint: 'test -f .nuxt/eslint.config.mjs || nuxt prepare',
      lint: 'eslint .',
      quality: 'pnpm run lint && pnpm run typecheck',
    },
    dependencies: appDeps,
    devDependencies: appDevDeps,
    overrides: templateWebPkg.overrides || {},
    volta: templateWebPkg.volta || { node: '22.22.0' },
  }
  if (rootPkg.scripts?.['db:seed']) {
    ;(webPkg.scripts as Record<string, string>)['db:seed'] =
      rootPkg.scripts['db:seed'].replace(/wrangler d1 execute \S+/, `wrangler d1 execute ${dbName}`)
  }
  if (!dryRun) {
    writeFileSync(
      join(appsWeb, 'package.json'),
      JSON.stringify(webPkg, null, 2) + '\n',
      'utf-8',
    )
  }
  console.log('  ✓ apps/web/package.json written.')
  console.log()

  // Step 5: Copy layer from template
  console.log('Step 5: Copying layer from template...')
  const layerSrc = join(TEMPLATE_DIR, 'layers/narduk-nuxt-layer')
  const layerDest = join(appDir, 'layers/narduk-nuxt-layer')
  if (!existsSync(layerSrc)) {
    console.error('  ❌ Template layer not found.')
    process.exit(1)
  }
  rmRf(layerDest)
  cpR(layerSrc, join(appDir, 'layers/narduk-nuxt-layer'))
  console.log('  ✓ Layer copied.')
  console.log()

  // Step 6: Replace packages with template eslint-config
  console.log('Step 6: Replacing ESLint packages with template packages/eslint-config...')
  rmRf(join(appDir, 'eslint-plugin-nuxt-ui'))
  rmRf(join(appDir, 'eslint-plugin-nuxt-guardrails'))
  rmRf(join(appDir, 'eslint-plugins'))
  rmRf(join(appDir, 'tools/eslint-plugin-vue-official-best-practices'))
  const flatPackages = join(appDir, 'packages')
  if (existsSync(flatPackages)) {
    readdirSync(flatPackages).forEach((entry) => {
      rmRf(join(flatPackages, entry))
    })
  }
  const eslintConfigSrc = join(TEMPLATE_DIR, 'packages/eslint-config')
  const eslintConfigDest = join(appDir, 'packages/eslint-config')
  rmRf(eslintConfigDest)
  if (!dryRun) {
    execSync(`cp -R "${eslintConfigSrc}" "${eslintConfigDest}"`, { encoding: 'utf-8' })
  } else {
    console.log(`  [dry-run] cp -R template packages/eslint-config → packages/eslint-config`)
  }
  console.log('  ✓ packages/eslint-config in place.')
  console.log()

  // Step 7: pnpm-workspace.yaml
  console.log('Step 7: Writing pnpm-workspace.yaml...')
  const workspaceYaml = `packages:
  - 'apps/*'
  - 'packages/*'
  - 'layers/*'

# Allow install to succeed when layer/app have peer mismatches (e.g. eslint 10)
pnpm:
  strictPeerDependencies: false
`
  if (!dryRun) {
    writeFileSync(join(appDir, 'pnpm-workspace.yaml'), workspaceYaml, 'utf-8')
  }
  console.log('  ✓ pnpm-workspace.yaml written.')
  console.log()

  // Step 8: Ensure apps/web/nuxt.config.ts extends layer and has nitro-cloudflare-dev
  console.log('Step 8: Updating apps/web/nuxt.config.ts to extend layer...')
  const nuxtConfigPath = join(appsWeb, 'nuxt.config.ts')
  if (existsSync(nuxtConfigPath)) {
    let content = readFileSync(nuxtConfigPath, 'utf-8')
    let changed = false
    if (!content.includes("extends:") && !content.includes('extends :')) {
      content = content.replace(
        /export default defineNuxtConfig\(\{\s*\n/,
        "export default defineNuxtConfig({\n  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],\n  ",
      )
      changed = true
    }
    if (!content.includes('nitro-cloudflare-dev')) {
      if (!content.includes('resolve(__dirname')) {
        const pathImport = "import { resolve, dirname } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nconst __dirname = dirname(fileURLToPath(import.meta.url))\n\n"
        content = content.startsWith('import ') ? content : pathImport + content
      }
      content = content.replace(
        /(extends:\s*\[[^\]]+\],?\s*\n)/,
        "$1  modules: ['nitro-cloudflare-dev'],\n  nitro: { cloudflareDev: { configPath: resolve(__dirname, 'wrangler.json') } },\n",
      )
      changed = true
    }
    if (changed && !dryRun) {
      writeFileSync(nuxtConfigPath, content, 'utf-8')
    }
  }
  console.log('  ✓ nuxt.config.ts updated.')
  console.log()

  // Step 9: Root package.json — orchestrator, no "type": "module"
  console.log('Step 9: Writing root package.json (orchestrator)...')
  const templateRootPkg = JSON.parse(readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8'))
  const rootScripts: Record<string, string> = {
    predev: 'node tools/check-setup.cjs',
    dev: 'pnpm --filter web dev',
    prebuild: 'node tools/check-setup.cjs',
    build: 'doppler run -- pnpm -r build',
    predeploy: 'node tools/check-setup.cjs',
    deploy: 'doppler run -- pnpm --filter web run deploy',
    postinstall:
      "node -e \"if(!require('fs').existsSync('.setup-complete'))console.log('\\n⚠️  Run pnpm run setup before doing anything else! See AGENTS.md.\\n')\"",
    'build:plugins': 'pnpm --filter @narduk/eslint-config build',
    prelint: 'pnpm run build:plugins',
    lint: 'pnpm run prelint && turbo run lint',
    typecheck: 'turbo run typecheck',
    quality: 'turbo run quality',
    setup: 'npx tsx tools/init.ts',
    'update-layer': 'npx tsx tools/update-layer.ts',
    'sync-template': 'npx tsx tools/sync-template.ts',
    'migrate-to-org': 'npx tsx tools/migrate-to-org.ts',
    validate: 'doppler run -- npx tsx tools/validate.ts',
    'generate:favicons': 'npx tsx tools/generate-favicons.ts',
    'db:migrate': 'pnpm --filter web run db:migrate',
  }
  const newRootPkg: Record<string, unknown> = {
    name: rootPkg.name,
    version: rootPkg.version,
    private: true,
    packageManager: templateRootPkg.packageManager || 'pnpm@10.28.0',
    scripts: rootScripts,
    pnpm: templateRootPkg.pnpm,
    volta: templateRootPkg.volta,
    devDependencies: {
      '@types/node': templateRootPkg.devDependencies?.['@types/node'],
      tsx: '^4.21.0',
      turbo: templateRootPkg.devDependencies?.turbo,
    },
  }
  delete (newRootPkg as Record<string, unknown>).type
  if (!dryRun) {
    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify(newRootPkg, null, 2) + '\n',
      'utf-8',
    )
  }
  console.log('  ✓ Root package.json written.')
  console.log()

  // Step 10: apps/web/eslint.config.mjs — slim
  const eslintConfigDestPath = join(appsWeb, 'eslint.config.mjs')
  const slimEslint = `// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import { sharedConfigs } from '@narduk/eslint-config'
export default withNuxt(...sharedConfigs)
`
  if (!dryRun) {
    writeFileSync(eslintConfigDestPath, slimEslint, 'utf-8')
  }
  console.log('  ✓ apps/web/eslint.config.mjs written (slim).')
  console.log()

  // Step 11: Add nitro-cloudflare-dev to apps/web if missing (only when not dry-run and file exists)
  if (!dryRun && existsSync(join(appsWeb, 'package.json'))) {
    const webPkgPath = join(appsWeb, 'package.json')
    const finalWebPkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'))
    if (!finalWebPkg.devDependencies?.['nitro-cloudflare-dev']) {
      finalWebPkg.devDependencies = finalWebPkg.devDependencies || {}
      finalWebPkg.devDependencies['nitro-cloudflare-dev'] = '^0.2.2'
      writeFileSync(webPkgPath, JSON.stringify(finalWebPkg, null, 2) + '\n', 'utf-8')
    }
  }
  console.log('  ✓ nitro-cloudflare-dev ensured in apps/web.')
  console.log()

  console.log('═══════════════════════════════════════════════════════════════')
  if (dryRun) {
    console.log(' DRY RUN — no changes were made.')
    console.log(' Re-run without --dry-run to apply.')
  } else {
    console.log(' Migration complete. Next steps:')
    console.log(`   cd ${appDir}`)
    console.log('   pnpm install')
    console.log('   pnpm run build:plugins')
    console.log('   pnpm run quality')
    console.log('   git add -A && git status')
  }
  console.log()
}

main()
