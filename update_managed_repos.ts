import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const auditResultsPath = join(
  process.env.HOME || '',
  '.gemini/antigravity/brain/d95663b6-4a6b-4784-bc18-b3d7b45adb40/prod_fleet_audit_results.json',
)
const results = JSON.parse(readFileSync(auditResultsPath, 'utf8'))

const measurements = {}
for (const repo of results) {
  if (repo.checks) {
    const gaCheck = repo.checks.find((c) => c.name === 'GA Measurement ID')
    if (gaCheck && gaCheck.actual) {
      measurements[repo.app] = gaCheck.actual
    }
  }
}

console.log('Found measurements mapping:', measurements)

const managedReposPath = join(__dirname, 'apps/web/server/data/managed-repos.ts')
let content = readFileSync(managedReposPath, 'utf8')

for (const [app, gaId] of Object.entries(measurements)) {
  const regex = new RegExp(`(name:\\s*'${app}',[\\s\\S]*?gaMeasurementId:\\s*)null(,)`, 'g')
  content = content.replace(regex, `$1'${gaId}'$2`)
}

writeFileSync(managedReposPath, content)
console.log('Updated managed-repos.ts')
