#!/usr/bin/env -S pnpm exec tsx
/**
 * Wires each agent’s `skills` directory to the global library at ~/.skills using the new
 * physical-copy architecture:
 * - `.agents/skills` → Physical copy of ~/.skills (via rsync)
 * - `.cursor/skills`, `.codex/skills`, `.github/skills`, `.agent/skills`, `.claude/skills` → Symlinks to `../.agents/skills`
 *
 * Invoked by `pnpm run skills:link`, at the start of `sync-template` / `update-layer`
 * (before the app dirty check), and from `sync-fleet` when auto-commit skips a dirty app.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const selfPath = fileURLToPath(import.meta.url)
const entryPath = process.argv[1] ? resolve(process.argv[1]) : ''
const isMainModule = Boolean(entryPath && entryPath === selfPath)

const AGENT_SKILL_ROOTS = ['.cursor', '.codex', '.agent', '.github', '.claude']

export interface EnsureSkillsLinksOptions {
  dryRun?: boolean
  log?: (message: string) => void
}

function ensureParentDir(dir: string, dryRun: boolean, log: (message: string) => void) {
  if (existsSync(dir)) return
  log(`  ADD: mkdir ${dir}`)
  if (!dryRun) {
    mkdirSync(dir, { recursive: true })
  }
}

/** True if anything exists at path (including a broken symlink). */
function pathOccupied(linkPath: string): boolean {
  try {
    lstatSync(linkPath)
    return true
  } catch {
    return false
  }
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

  // 1. Rsync the global skills to local .agents/skills
  const localAgentsDir = join(appDir, '.agents')
  const localSkillsDir = join(localAgentsDir, 'skills')
  ensureParentDir(localAgentsDir, dryRun, log)
  
  log(`  SYNC: Physical sync from ~/.skills to .agents/skills via rsync`)
  if (!dryRun) {
    try {
      execSync(`rsync -a --delete "${globalSkillsDir}/" "${localSkillsDir}/"`, { stdio: 'pipe' })
    } catch (err) {
      log(`  ERROR: rsync failed. Ensure rsync is installed.`)
    }
  }

  // 2. Symlink others to ../.agents/skills
  for (const root of AGENT_SKILL_ROOTS) {
    const rootDir = join(appDir, root)
    const linkPath = join(rootDir, 'skills')
    
    ensureParentDir(rootDir, dryRun, log)
    
    let needsReplace = false
    if (pathOccupied(linkPath)) {
      needsReplace = true
      try {
        const st = lstatSync(linkPath)
        if (st.isSymbolicLink()) {
          const target = readlinkSync(linkPath)
          if (target === '../.agents/skills') {
            needsReplace = false // already correct
          }
        }
      } catch {}
    } else {
      needsReplace = true
    }

    if (needsReplace) {
      if (pathOccupied(linkPath)) {
        log(`  REMOVE old symlink/dir: ${linkPath}`)
        if (!dryRun) rmSync(linkPath, { recursive: true, force: true })
      }
      
      log(`  ADD symlink: ${root}/skills -> ../.agents/skills`)
      if (!dryRun) {
        // Create relative symlink
        const originalDir = process.cwd()
        process.chdir(rootDir)
        try {
          symlinkSync('../.agents/skills', 'skills')
        } finally {
          process.chdir(originalDir)
        }
      }
    }
  }
  
  // Clean up legacy repo-root .skills
  const legacyRootSkills = join(appDir, '.skills')
  if (pathOccupied(legacyRootSkills)) {
    log(`  REMOVE: legacy repo-root .skills`)
    if (!dryRun) rmSync(legacyRootSkills, { recursive: true, force: true })
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
