import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * VALIDATE.TS — Nuxt v4 Template Setup Validation Script
 * ----------------------------------------------------------------
 * Confirms that the necessary infrastructure and configurations have been successfully
 * provisioned for the current project.
 * 
 * Usage:
 *   npm run validate
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

// --- Helper Functions ---
function checkCommand(command: string, successMessage: string, errorMessage: string) {
  try {
    execSync(command, { encoding: 'utf-8', stdio: 'pipe' })
    console.log(`  ✅ ${successMessage}`)
    return true
  } catch (error: any) {
    console.error(`  ❌ ${errorMessage}: ${error.stderr || error.message}`)
    return false
  }
}

async function main() {
  const packageJsonPath = path.join(ROOT_DIR, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
  const APP_NAME = packageJson.name

  let allGood = true
  if (!APP_NAME || APP_NAME === 'nuxt-v4-template') {
    console.error(`  ❌ Project name is still 'nuxt-v4-template'. Has init been run?`)
    allGood = false
  }

  console.log(`\n🔍 Validating Setup for: ${APP_NAME}`)

  // 1. Check Wrangler (D1 Database)
  console.log('\nStep 1/4: Validating D1 Database...')
  const dbName = `${APP_NAME}-db`
  allGood = checkCommand(
    `npx wrangler d1 info ${dbName}`,
    `Database ${dbName} exists and is accessible.`,
    `Database ${dbName} not found or Wrangler not authenticated`
  ) && allGood

  // 2. Check wrangler.json
  console.log('\nStep 2/4: Validating wrangler.json...')
  try {
    const wranglerPath = path.join(ROOT_DIR, 'wrangler.json')
    const wranglerContent = await fs.readFile(wranglerPath, 'utf-8')
    const parsedWrangler = JSON.parse(wranglerContent)
    
    if (parsedWrangler.d1_databases && parsedWrangler.d1_databases.length > 0) {
      const dbId = parsedWrangler.d1_databases[0].database_id
      if (dbId && dbId.length > 0) {
        console.log(`  ✅ Database ID configured in wrangler.json: ${dbId}`)
      } else {
        console.error('  ❌ Database ID missing from wrangler.json.')
        allGood = false
      }
    } else {
      console.error('  ❌ d1_databases misconfigured in wrangler.json.')
      allGood = false
    }
  } catch (e: any) {
    console.error(`  ❌ Failed to read or parse wrangler.json: ${e.message}`)
    allGood = false
  }

  // 3. Doppler
  console.log('\nStep 3/4: Validating Doppler Configuration...')
  allGood = checkCommand(
    `doppler projects get ${APP_NAME}`,
    `Doppler project ${APP_NAME} exists.`,
    `Doppler project ${APP_NAME} not found`
  ) && allGood

  try {
    // Check if expected secrets exist
    const output = execSync(
      `doppler secrets --project ${APP_NAME} --config prd --only-names --plain`,
      { encoding: 'utf-8', stdio: 'pipe' }
    )
    const existing = new Set(output.trim().split('\n').filter(Boolean))
    const requiredSecrets = ['CLOUDFLARE_API_TOKEN', 'APP_NAME']
    
    const missing = requiredSecrets.filter(s => !existing.has(s))
    if (missing.length === 0) {
      console.log(`  ✅ Core Doppler secrets are present.`)
    } else {
      console.error(`  ❌ Missing Doppler secrets: ${missing.join(', ')}`)
      allGood = false
    }
  } catch {
    console.error('  ❌ Failed to fetch Doppler secrets.')
    allGood = false
  }

  // 4. GitHub Secret
  console.log('\nStep 4/4: Validating GitHub Secrets...')
  let targetRepoFlag = ''
  try {
    const remotesOutput = execSync('git remote -v', { encoding: 'utf-8', stdio: 'pipe' })
    const remotes = remotesOutput.split('\n').filter(Boolean)
    const targetRemoteLine = remotes.find(line => !line.includes('nuxt-v4-template') && line.includes('(push)'))
    if (targetRemoteLine) {
      let url = targetRemoteLine.split(/\s+/)[1]
      url = url.replace(/^(https?:\/\/|git@)/, '').replace(/^github\.com[:/]/, '').replace(/\.git$/, '')
      if (url) {
        targetRepoFlag = `--repo "${url}"`
        console.log(`  🎯 Checking secrets for repository: ${url}`)
      }
    }
  } catch {
    // Ignore error
  }

  try {
    const ghOutput = execSync(`gh secret list ${targetRepoFlag}`, { encoding: 'utf-8', stdio: 'pipe' })
    if (ghOutput.includes('DOPPLER_TOKEN')) {
      console.log(`  ✅ DOPPLER_TOKEN is set in GitHub repository.`)
    } else {
      console.error('  ❌ DOPPLER_TOKEN is missing from GitHub repository.')
      allGood = false
    }
  } catch (error: any) {
    const stderr = error.stderr || error.message || ''
    console.error(`  ❌ Failed to list GitHub secrets: ${stderr}`)
    allGood = false
  }

  console.log('\n--- Validation Result ---')
  if (allGood) {
    console.log('🎉 All infrastructure checks passed successfully! Your project is ready.')
  } else {
    console.error('⚠️ Some checks failed. Please review the errors above and fix the issues, or rerun init.')
    process.exit(1)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
