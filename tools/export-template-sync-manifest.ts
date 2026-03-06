import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSyncManagedRepos } from '../apps/web/server/data/managed-repos'

const args = process.argv.slice(2)
const templateDirArg = args
  .find((arg) => arg.startsWith('--template-dir='))
  ?.slice('--template-dir='.length)

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const templateDir = templateDirArg
  ? resolve(templateDirArg)
  : resolve(ROOT_DIR, '../../narduk-nuxt-template')
const outputPath = resolve(templateDir, 'config/fleet-sync-repos.json')

const repos = getSyncManagedRepos()
  .map((repo) => repo.name)
  .sort((a, b) => a.localeCompare(b))

const manifest = {
  source: 'control-plane/apps/web/server/data/managed-repos.ts',
  repoCount: repos.length,
  repos,
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

console.log(`Wrote ${repos.length} sync-managed repo(s) to ${outputPath}`)
