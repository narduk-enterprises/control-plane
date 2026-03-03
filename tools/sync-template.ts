/**
 * SYNC-TEMPLATE.TS — Standardize a Derived App Against the Template
 * ----------------------------------------------------------------
 * Copies critical infrastructure files from this template repository
 * to a derived app, switches CI to reusable workflows, and writes
 * a .template-version sentinel for drift tracking.
 *
 * Safe to re-run — all steps are idempotent.
 *
 * Usage:
 *   npx tsx tools/sync-template.ts <app-dir>
 *   npx tsx tools/sync-template.ts ~/new-code/neon-sewer-raid
 *   npx tsx tools/sync-template.ts ~/new-code/neon-sewer-raid --dry-run
 *   npx tsx tools/sync-template.ts ~/new-code/neon-sewer-raid --strict  # fail on remaining drift
 *
 * Options:
 *   --dry-run   Show what would change without writing anything
 *   --strict    Exit 1 if any drift remains after sync (for CI gating)
 */

import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '..')

const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith('--')))
const dryRun = flags.has('--dry-run')
const strict = flags.has('--strict')

const appDir = args[0]?.replace(/^~/, process.env.HOME || '')
if (!appDir) {
  console.error('Usage: npx tsx tools/sync-template.ts <app-directory> [--dry-run] [--strict]')
  console.error('  e.g: npx tsx tools/sync-template.ts ~/new-code/neon-sewer-raid')
  process.exit(1)
}

if (!existsSync(appDir)) {
  console.error(`App directory not found: ${appDir}`)
  process.exit(1)
}

const appName = appDir.split('/').pop() || 'unknown'

// ─── File Categories ─────────────────────────────────────────

/** Files that must be identical to the template (copied verbatim). */
const COPY_VERBATIM = [
  // Tooling
  'tools/update-layer.ts',
  'tools/check-drift-ci.ts',
  'tools/generate-favicons.ts',
  'tools/check-setup.js',

  // CI/CD
  '.github/workflows/version-bump.yml',

  // Build orchestration
  'turbo.json',

  // Renovate
  'renovate.json',

  // ESLint shared config
  'packages/eslint-config/eslint.config.mjs',
  'packages/eslint-config/eslint-plugins/index.mjs',

  // Copilot/agent infra
  '.github/copilot-instructions.md',
]

/** Agent workflow files — copy if missing, don't overwrite customizations. */
const COPY_IF_MISSING = [
  '.agents/workflows/check-architecture.md',
  '.agents/workflows/check-data-fetching.md',
  '.agents/workflows/check-plugin-lifecycle.md',
  '.agents/workflows/check-seo-compliance.md',
  '.agents/workflows/check-ssr-hydration-safety.md',
  '.agents/workflows/check-ui-styling.md',
  '.agents/workflows/check-layer-health.md',
  '.agents/workflows/check-standardization.md',
  '.agents/workflows/review-cloudflare-layer.md',
  '.agents/workflows/review-doppler-pattern.md',
  '.agents/workflows/audit-repo-hygiene.md',
  '.agents/workflows/audit-init-flow.md',
  '.agents/workflows/deploy.md',
  '.agents/workflows/score-repo.md',
  '.agents/workflows/generate-app-idea.md',
  '.agents/workflows/generate-brand-identity.md',
  '.agents/workflows/migrate-local.md',
  '.agents/workflows/migrate-to-monorepo.md',
  '.agents/workflows/standardize-app.md',
]

/** Directories where ALL files must be synced (new files added, existing files updated). */
const SYNC_DIRECTORIES = [
  'packages/eslint-config/eslint-plugins/rules',
]

/** Files that should be removed from derived apps. */
const REMOVE_STALE = [
  '.github/workflows/publish-layer.yml',
  '.github/workflows/deploy-showcase.yml',
  '.github/workflows/reusable-quality.yml',
  '.github/workflows/reusable-deploy.yml',
  '.env',
  '.env.local',
  '.env.example',
]

// ─── Helpers ─────────────────────────────────────────────────

function ensureDir(filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function filesIdentical(a: string, b: string): boolean {
  try {
    return readFileSync(a).equals(readFileSync(b))
  }
  catch {
    return false
  }
}

// ─── Main ────────────────────────────────────────────────────

function main() {
  console.log()
  console.log(`Template Sync: ${appName}${dryRun ? ' [DRY RUN]' : ''}`)
  console.log(`═══════════════════════════════════════════════════════════════`)
  console.log(`  App:      ${appDir}`)
  console.log(`  Template: ${TEMPLATE_DIR}`)
  console.log()

  let copied = 0
  let skipped = 0
  let added = 0
  let removed = 0

  // Phase 1: Copy verbatim files
  console.log('Phase 1: Syncing critical infrastructure files...')
  for (const file of COPY_VERBATIM) {
    const src = join(TEMPLATE_DIR, file)
    const dest = join(appDir, file)

    if (!existsSync(src)) continue

    if (existsSync(dest) && filesIdentical(src, dest)) {
      skipped++
      continue
    }

    const action = existsSync(dest) ? 'UPDATE' : 'ADD'
    console.log(`  ${action}: ${file}`)
    if (!dryRun) {
      ensureDir(dest)
      copyFileSync(src, dest)
    }
    copied++
  }
  // Also sync entire directories (e.g., ESLint rule files)
  for (const dir of SYNC_DIRECTORIES) {
    const srcDir = join(TEMPLATE_DIR, dir)
    const destDir = join(appDir, dir)
    if (!existsSync(srcDir)) continue

    for (const file of readdirSync(srcDir)) {
      const src = join(srcDir, file)
      const dest = join(destDir, file)

      if (existsSync(dest) && filesIdentical(src, dest)) {
        skipped++
        continue
      }

      const action = existsSync(dest) ? 'UPDATE' : 'ADD'
      console.log(`  ${action}: ${join(dir, file)}`)
      if (!dryRun) {
        ensureDir(dest)
        copyFileSync(src, dest)
      }
      copied++
    }
  }

  console.log(`  ${copied} files synced, ${skipped} already up to date.`)
  console.log()

  // Phase 2: Add missing workflow files
  console.log('Phase 2: Adding missing agent workflows...')
  for (const file of COPY_IF_MISSING) {
    const src = join(TEMPLATE_DIR, file)
    const dest = join(appDir, file)

    if (!existsSync(src) || existsSync(dest)) continue

    console.log(`  ADD: ${file}`)
    if (!dryRun) {
      ensureDir(dest)
      copyFileSync(src, dest)
    }
    added++
  }
  console.log(`  ${added} workflows added.`)
  console.log()

  // Phase 3: Replace CI with reusable-workflow version
  console.log('Phase 3: Switching CI to reusable workflows...')
  const ciPath = join(appDir, '.github/workflows/ci.yml')
  const slimCi = `name: CI

on:
  workflow_dispatch:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    uses: narduk-enterprises/narduk-nuxt-template/.github/workflows/reusable-quality.yml@main

  deploy:
    if: github.event_name != 'pull_request'
    needs: [quality]
    uses: narduk-enterprises/narduk-nuxt-template/.github/workflows/reusable-deploy.yml@main
    secrets:
      DOPPLER_TOKEN: \${{ secrets.DOPPLER_TOKEN }}
      CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
`

  if (existsSync(ciPath)) {
    const current = readFileSync(ciPath, 'utf-8')
    if (current.includes('reusable-quality.yml')) {
      console.log('  Already using reusable workflows.')
    }
    else {
      console.log('  REPLACE: .github/workflows/ci.yml -> reusable workflow caller')
      if (!dryRun) {
        writeFileSync(ciPath, slimCi, 'utf-8')
      }
    }
  }
  else {
    console.log('  ADD: .github/workflows/ci.yml')
    if (!dryRun) {
      ensureDir(ciPath)
      writeFileSync(ciPath, slimCi, 'utf-8')
    }
  }
  console.log()

  // Phase 4: Write .template-version
  console.log('Phase 4: Writing .template-version...')
  let templateSha = ''
  try {
    templateSha = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: TEMPLATE_DIR,
    }).trim()
  }
  catch { /* ignore */ }

  const versionContent = [
    `sha=${templateSha || 'unknown'}`,
    `template=narduk-nuxt-template`,
    `synced=${new Date().toISOString()}`,
    '',
  ].join('\n')

  const versionPath = join(appDir, '.template-version')
  console.log(`  ${existsSync(versionPath) ? 'UPDATE' : 'ADD'}: .template-version (${templateSha.slice(0, 12) || 'unknown'})`)
  if (!dryRun) {
    writeFileSync(versionPath, versionContent, 'utf-8')
  }
  console.log()

  // Phase 5: Remove stale files
  console.log('Phase 5: Cleaning stale files...')
  for (const file of REMOVE_STALE) {
    const target = join(appDir, file)
    if (!existsSync(target)) continue

    console.log(`  DELETE: ${file}`)
    if (!dryRun) {
      rmSync(target, { force: true })
    }
    removed++
  }
  if (removed === 0) console.log('  No stale files found.')
  console.log()

  // Phase 6: Patch .gitignore
  console.log('Phase 6: Patching .gitignore...')
  const gitignorePath = join(appDir, '.gitignore')
  if (existsSync(gitignorePath)) {
    let gi = readFileSync(gitignorePath, 'utf-8')
    let patched = false

    if (!gi.includes('.turbo')) {
      gi = gi.replace(/\.cache\n/, '.cache\n.turbo\n')
      patched = true
      console.log('  ADD: .turbo to .gitignore')
    }

    if (gi.includes('tools/eslint-plugin-vue-official-best-practices')) {
      gi = gi.replace(/.*tools\/eslint-plugin-vue-official-best-practices.*\n?/g, '')
      patched = true
      console.log('  REMOVE: stale eslint-plugin path from .gitignore')
    }

    if (patched && !dryRun) {
      writeFileSync(gitignorePath, gi, 'utf-8')
    }
    if (!patched) {
      console.log('  .gitignore is up to date.')
    }
  }
  console.log()

  // Phase 7: Ensure .npmrc has strict-peer-dependencies
  console.log('Phase 7: Checking .npmrc...')
  const npmrcPath = join(appDir, '.npmrc')
  if (existsSync(npmrcPath)) {
    let npmrc = readFileSync(npmrcPath, 'utf-8')
    if (!npmrc.includes('strict-peer-dependencies')) {
      console.log('  ADD: strict-peer-dependencies=true')
      if (!dryRun) {
        npmrc += '\nstrict-peer-dependencies=true\n'
        writeFileSync(npmrcPath, npmrc, 'utf-8')
      }
    }
    else {
      console.log('  .npmrc already has strict-peer-dependencies.')
    }
  }
  else {
    console.log('  ADD: .npmrc with registry + strict-peer-dependencies')
    if (!dryRun) {
      writeFileSync(npmrcPath, [
        '@loganrenz:registry=https://npm.pkg.github.com',
        '',
        'strict-peer-dependencies=true',
        '',
      ].join('\n'), 'utf-8')
    }
  }
  console.log()

  // Phase 8: Update root package.json scripts
  console.log('Phase 8: Checking root package.json scripts...')
  const rootPkgPath = join(appDir, 'package.json')
  if (existsSync(rootPkgPath)) {
    const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))
    const scripts = pkg.scripts || {}
    let patchCount = 0

    const requiredScripts: Record<string, string> = {
      'predev': 'node tools/check-setup.js',
      'prebuild': 'node tools/check-setup.js',
      'predeploy': 'node tools/check-setup.js',
      'update-layer': 'npx tsx tools/update-layer.ts',
      'generate:favicons': 'npx tsx tools/generate-favicons.ts',
    }

    for (const [name, cmd] of Object.entries(requiredScripts)) {
      if (!scripts[name]) {
        console.log(`  ADD script: "${name}"`)
        scripts[name] = cmd
        patchCount++
      }
    }

    if (patchCount > 0) {
      pkg.scripts = scripts
      if (!dryRun) {
        writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
      }
      console.log(`  ${patchCount} scripts added.`)
    }
    else {
      console.log('  All required scripts present.')
    }
  }
  console.log()

  // Summary
  console.log('═══════════════════════════════════════════════════════════════')
  if (dryRun) {
    console.log(' DRY RUN — no files were modified.')
    console.log(' Re-run without --dry-run to apply changes.')
  }
  else {
    console.log(` Sync complete.`)
    console.log()
    console.log(' Next steps:')
    console.log(`   cd ${appDir}`)
    console.log('   pnpm install')
    console.log('   pnpm run update-layer          # pull latest layer')
    console.log('   pnpm run quality                # verify nothing broke')
    console.log('   git add -A && git diff --cached # review changes')
    console.log('   git commit -m "chore: sync with template infra"')
  }
  console.log()

  if (strict) {
    // Run a quick drift check to see if anything remains
    const driftScript = join(appDir, 'tools/check-drift-ci.ts')
    if (existsSync(driftScript)) {
      try {
        execSync(`npx tsx ${driftScript} --strict`, { stdio: 'inherit', cwd: appDir })
      }
      catch {
        process.exit(1)
      }
    }
  }
}

main()
