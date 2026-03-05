import { execSync } from 'node:child_process'
import { getFleetApps } from '../apps/web/server/data/fleet-registry'

async function checkIndexNow() {
  const apps = getFleetApps()
  console.log(`🔍 Checking IndexNow setup for ${apps.length} apps...\n`)

  for (const app of apps) {
    try {
      // 1. Get the INDEXNOW_KEY from Doppler
      let indexNowKey = ''
      try {
        const out = execSync(`doppler secrets get INDEXNOW_KEY --project "${app.dopplerProject}" --config prd --plain`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
        indexNowKey = out.trim()
      } catch (e) {
        console.log(`❌ ${app.dopplerProject.padEnd(28)}: Missing INDEXNOW_KEY in Doppler`)
        continue
      }

      if (!indexNowKey) {
        console.log(`❌ ${app.dopplerProject.padEnd(28)}: Empty INDEXNOW_KEY in Doppler`)
        continue
      }

      // 2. Check the /{key}.txt endpoint on the live site
      const url = `${app.url}/${indexNowKey}.txt`
      const res = await fetch(url)
      
      if (!res.ok) {
        console.log(`❌ ${app.dopplerProject.padEnd(28)}: /${indexNowKey}.txt returned HTTP ${res.status}`)
        continue
      }

      const text = await res.text()

      if (text.trim() === indexNowKey) {
        console.log(`✅ ${app.dopplerProject.padEnd(28)}: Verified /${indexNowKey}.txt`)
      } else {
        console.log(`❌ ${app.dopplerProject.padEnd(28)}: /${indexNowKey}.txt payload mismatch! (Got: ${text.substring(0, 32)})`)
      }

    } catch (e: any) {
      console.error(`❌ ${app.dopplerProject.padEnd(28)}: Network/Execution error - ${e.message}`)
    }
  }
  
  console.log('\n🏁 IndexNow fleet checks complete.')
}

checkIndexNow()
