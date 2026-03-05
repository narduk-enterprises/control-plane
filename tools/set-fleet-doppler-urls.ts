/**
 * Set Doppler secrets in each fleet app's project (prd) to match the control-plane registry.
 * Fetches the app list from the control plane API.
 *
 * Usage:
 *   npx tsx tools/set-fleet-doppler-urls.ts             # set SITE_URL in all fleet projects
 *   npx tsx tools/set-fleet-doppler-urls.ts --dry-run   # print what would be set
 *   npx tsx tools/set-fleet-doppler-urls.ts --sync-analytics          # push analytics hub refs
 *   npx tsx tools/set-fleet-doppler-urls.ts --sync-analytics --dry-run
 *
 * Requires: doppler CLI (doppler.com/docs/cli), auth (doppler login or DOPPLER_TOKEN),
 * and write access to each fleet project in Doppler.
 */

import { execSync } from 'node:child_process';

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk';
const dryRun = process.argv.includes('--dry-run');
const syncAnalytics = process.argv.includes('--sync-analytics');

interface FleetApp {
  name: string;
  url: string;
  dopplerProject: string;
}

async function fetchFleetApps(): Promise<FleetApp[]> {
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<FleetApp[]>;
  } catch {
    console.error(`❌ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps`);
    process.exit(1);
  }
}

function isDopplerAvailable(): boolean {
  try {
    execSync('doppler --version', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function setSecret(project: string, config: string, key: string, value: string): boolean {
  try {
    execSync(
      `doppler secrets set ${key}="${value.replace(/"/g, '\\"')}" --project "${project}" --config ${config} --silent`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch {
    return false;
  }
}

// Analytics hub refs — pushed wholesale to every fleet app so they inherit the shared
// PostHog key, reverse-proxy host, and GA property from the hub project.
const HUB = 'narduk-nuxt-template';
const ANALYTICS_HUB_REFS: Record<string, string> = {
  POSTHOG_PUBLIC_KEY: `\${${HUB}.prd.POSTHOG_PUBLIC_KEY}`,
  POSTHOG_HOST: `\${${HUB}.prd.POSTHOG_HOST}`,
  GA_MEASUREMENT_ID: `\${${HUB}.prd.GA_MEASUREMENT_ID}`,
};

async function main() {
  if (!isDopplerAvailable()) {
    console.error(
      '❌ Doppler CLI not available. Install: https://docs.doppler.com/docs/install-cli'
    );
    process.exit(1);
  }

  const apps = await fetchFleetApps();
  console.log('');

  if (syncAnalytics) {
    // ── Analytics hub-ref sync ─────────────────────────────────────────────
    const keys = Object.keys(ANALYTICS_HUB_REFS).join(', ');
    console.log(
      dryRun
        ? `Fleet Doppler analytics sync (dry run — no changes): ${keys}`
        : `Syncing analytics hub refs to fleet Doppler projects (prd): ${keys}`
    );
    console.log('────────────────────────────────────────────────────────');

    let ok = 0,
      fail = 0;
    for (const app of apps) {
      if (dryRun) {
        for (const [k, v] of Object.entries(ANALYTICS_HUB_REFS)) {
          console.log(`  ${app.name.padEnd(28)} ${k}=${v}`);
        }
        ok++;
        continue;
      }
      // Set all analytics refs at once
      const pairs = Object.entries(ANALYTICS_HUB_REFS)
        .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
        .join(' ');
      try {
        execSync(
          `doppler secrets set ${pairs} --project "${app.dopplerProject}" --config prd --silent`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        console.log(`  ✅ ${app.name.padEnd(28)} synced ${keys}`);
        ok++;
      } catch {
        console.log(`  ❌ ${app.name.padEnd(28)} failed (no write access or project missing?)`);
        fail++;
      }
    }
    console.log('────────────────────────────────────────────────────────');
    if (dryRun) {
      console.log(`Would sync analytics refs for ${ok} projects. Run without --dry-run to apply.`);
    } else {
      console.log(`Done: ${ok} updated, ${fail} failed.`);
    }
    console.log('');
    if (fail > 0) process.exit(1);
    return;
  }

  // ── Default: SITE_URL sync ─────────────────────────────────────────────
  console.log(
    dryRun
      ? 'Fleet Doppler SITE_URL (dry run — no changes)'
      : 'Setting SITE_URL in fleet Doppler projects (prd)'
  );
  console.log('────────────────────────────────────────────────────────');

  let ok = 0;
  let fail = 0;
  for (const app of apps) {
    if (dryRun) {
      console.log(`  ${app.name.padEnd(28)} SITE_URL=${app.url}`);
      ok++;
      continue;
    }
    const success = setSecret(app.dopplerProject, 'prd', 'SITE_URL', app.url);
    if (success) {
      console.log(`  ✅ ${app.name.padEnd(28)} SITE_URL=${app.url}`);
      ok++;
    } else {
      console.log(
        `  ❌ ${app.name.padEnd(28)} failed to set (no write access or project missing?)`
      );
      fail++;
    }
  }

  console.log('────────────────────────────────────────────────────────');
  if (dryRun) {
    console.log(`Would set SITE_URL for ${ok} projects. Run without --dry-run to apply.`);
  } else {
    console.log(`Done: ${ok} updated, ${fail} failed.`);
  }
  console.log('');
  if (fail > 0) process.exit(1);
}

main();
