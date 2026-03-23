#!/usr/bin/env npx tsx
/**
 * Ensures repo-local access to the user's global skill library (~/.skills):
 * - `.skills` → $HOME/.skills (creates ~/.skills if missing)
 * - `.cursor/skills/home`, `.codex/skills/home`, `.agent/skills/home` → repo `.skills`
 *
 * Invoked by `pnpm run skills:link` and at the end of sync-template (Phase 4).
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const selfPath = fileURLToPath(import.meta.url)
const entryPath = process.argv[1] ? resolve(process.argv[1]) : ''
const isMainModule = Boolean(entryPath && entryPath === selfPath)

export interface EnsureSkillsLinksOptions {
  dryRun?: boolean
  log?: (message: string) => void
}

function ensureParentDir(filePath: string, dryRun: boolean, log: (message: string) => void) {
  const dir = dirname(filePath)
  if (existsSync(dir)) return
  log(`  ADD: mkdir ${dir}`)
  if (!dryRun) {
    mkdirSync(dir, { recursive: true })
  }
}

function ensureSymlink(
  targetAbsolute: string,
  linkPath: string,
  label: string,
  dryRun: boolean,
  log: (message: string) => void,
): boolean {
  const want = resolve(targetAbsolute)
  ensureParentDir(linkPath, dryRun, log)

  if (existsSync(linkPath)) {
    try {
      const st = lstatSync(linkPath)
      if (st.isSymbolicLink()) {
        const cur = resolve(dirname(linkPath), readlinkSync(linkPath, 'utf8'))
        if (cur === want) {
          return false
        }
      }
    } catch {
      // fall through to replace
    }
    log(`  REPLACE symlink: ${label}`)
    if (!dryRun) {
      rmSync(linkPath, { recursive: true, force: true })
    }
  } else {
    log(`  ADD symlink: ${label}`)
  }

  if (!dryRun) {
    symlinkSync(want, linkPath)
  }
  return true
}

export function ensureSkillsLinks(appDir: string, options: EnsureSkillsLinksOptions = {}): void {
  const dryRun = options.dryRun ?? false
  const log = options.log ?? console.log
  const home = process.env.HOME || ''

  if (!home) {
    log('  SKIP: skills links (HOME is not set)')
    return
  }

  const globalSkillsDir = join(home, '.skills')
  if (!existsSync(globalSkillsDir)) {
    log(`  ADD: mkdir ${globalSkillsDir}`)
    if (!dryRun) {
      mkdirSync(globalSkillsDir, { recursive: true })
    }
  }

  const rootLink = join(appDir, '.skills')
  ensureSymlink(globalSkillsDir, rootLink, '.skills -> ~/.skills', dryRun, log)

  const repoSkills = resolve(appDir, '.skills')
  const bridges: { path: string; label: string }[] = [
    { path: join(appDir, '.cursor/skills/home'), label: '.cursor/skills/home -> .skills' },
    { path: join(appDir, '.codex/skills/home'), label: '.codex/skills/home -> .skills' },
    { path: join(appDir, '.agent/skills/home'), label: '.agent/skills/home -> .skills' },
  ]

  for (const { path: bridgePath, label } of bridges) {
    ensureSymlink(repoSkills, bridgePath, label, dryRun, log)
  }
}

if (isMainModule) {
  const root = resolve(__dirname, '..')
  const dryRun = process.argv.includes('--dry-run')
  console.log('')
  console.log(`Skills links: ${root}${dryRun ? ' [DRY RUN]' : ''}`)
  ensureSkillsLinks(root, { dryRun, log: console.log })
  console.log('')
}
