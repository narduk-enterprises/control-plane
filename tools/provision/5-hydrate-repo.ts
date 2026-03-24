import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function resolveAppDescription(displayName: string, appDescription?: string): string {
  const trimmed = appDescription?.trim()
  if (trimmed) {
    return trimmed
  }

  return `${displayName} — powered by Nuxt 4 and Cloudflare Workers.`
}

async function applyStarterPlaceholders(targetDir: string, req: Record<string, string>) {
  const STARTER_PLACEHOLDER_FILES = [
    'doppler.template.yaml',
    'package.json',
    'README.md',
    'provision.json',
    'SPEC.md',
    'apps/web/package.json',
    'apps/web/nuxt.config.ts',
    'apps/web/wrangler.json',
    'apps/web/public/site.webmanifest',
  ]
  const STARTER_REPLACEMENTS = [
    { from: /__APP_NAME__/g, to: req.APP_NAME },
    { from: /__DISPLAY_NAME__/g, to: req.DISPLAY_NAME },
    { from: /__SITE_URL__/g, to: req.SITE_URL },
    {
      from: /__APP_DESCRIPTION__/g,
      to: req.APP_DESCRIPTION,
    },
  ]

  let changedFiles = 0
  for (const relativePath of STARTER_PLACEHOLDER_FILES) {
    const absolutePath = path.join(targetDir, relativePath)
    try {
      const original = await fs.readFile(absolutePath, 'utf-8')
      let content = original
      for (const replacement of STARTER_REPLACEMENTS) {
        content = content.replace(replacement.from, replacement.to)
      }
      if (content !== original) {
        await fs.writeFile(absolutePath, content, 'utf-8')
        changedFiles++
      }
    } catch {
      // file missing
    }
  }
  console.log(`  ✅ Updated ${changedFiles} starter metadata file(s).`)
}

async function writeProvisionMetadata(
  targetDir: string,
  req: Record<string, string>,
): Promise<void> {
  const provisionPath = path.join(targetDir, 'provision.json')
  const provisionedAt = new Date().toISOString()
  let payload: Record<string, string> = {
    name: req.APP_NAME,
    displayName: req.DISPLAY_NAME,
    description: req.APP_DESCRIPTION,
    url: req.SITE_URL,
    provisionedAt,
  }

  try {
    const raw = await fs.readFile(provisionPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    payload = {
      ...Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === 'string'),
      ),
      ...payload,
    }
  } catch {
    // Create the file if the starter surface does not include it yet.
  }

  await fs.writeFile(provisionPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
  console.log('  ✅ Wrote provision.json')
}

async function seedSpecDocument(targetDir: string, req: Record<string, string>): Promise<void> {
  const specPath = path.join(targetDir, 'SPEC.md')
  const fallback = [
    'Status: DRAFT',
    '',
    `# ${req.DISPLAY_NAME}`,
    '',
    `Source: provision.json (${req.APP_NAME})`,
    '',
    '## Product',
    '',
    req.APP_DESCRIPTION,
    '',
    '## In scope',
    '',
    '- (fill during agent workflow)',
    '',
    '## Out of scope',
    '',
    '- (fill during agent workflow)',
    '',
    '## User flows',
    '',
    '1. ',
    '',
    '## Conceptual data model',
    '',
    '- ',
    '',
    '## Pages / routes',
    '',
    '- ',
    '',
    '## Non-functional',
    '',
    '- ',
    '',
    '## Test acceptance (MVP)',
    '',
    '- ',
    '',
    '## Open questions',
    '',
    '- ',
    '',
  ].join('\n')

  let content = fallback
  try {
    content = await fs.readFile(specPath, 'utf-8')
  } catch {
    // Fall back to the standard draft structure when SPEC.md is absent.
  }

  const lines = content.split('\n')
  if (lines[0]?.startsWith('Status:')) {
    lines[0] = 'Status: DRAFT'
  } else {
    lines.unshift('Status: DRAFT', '')
  }
  content = lines.join('\n')

  const productHeading = '## Product'
  const inScopeHeading = '## In scope'
  const productStart = content.indexOf(productHeading)
  const inScopeStart = content.indexOf(inScopeHeading)
  if (productStart !== -1 && inScopeStart !== -1 && inScopeStart > productStart) {
    const before = content.slice(0, productStart + productHeading.length)
    const after = content.slice(inScopeStart)
    content = `${before}\n\n${req.APP_DESCRIPTION}\n\n${after}`
  }

  await fs.writeFile(specPath, content, 'utf-8')
  console.log('  ✅ Seeded SPEC.md')
}

async function linkWrangler(targetDir: string, appName: string, siteUrl: string) {
  const appsDir = path.join(targetDir, 'apps')
  try {
    const entries = await fs.readdir(appsDir, { withFileTypes: true })
    const appDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !name.startsWith('example-'))

    for (const appDir of appDirs) {
      const wranglerPath = path.join(appsDir, appDir, 'wrangler.json')
      try {
        const wranglerContent = await fs.readFile(wranglerPath, 'utf-8')
        const parsedWrangler = JSON.parse(wranglerContent)

        parsedWrangler.name = appDir === 'web' ? appName : `${appName}-${appDir}`

        if (parsedWrangler.d1_databases && parsedWrangler.d1_databases.length > 0) {
          if (process.env.D1_DATABASE_ID) {
            parsedWrangler.d1_databases[0].database_id = process.env.D1_DATABASE_ID
          }
          delete parsedWrangler.d1_databases[0].preview_database_id
        }

        if (appDir === 'web') {
          try {
            const urlObj = new URL(siteUrl)
            if (!urlObj.hostname.endsWith('.workers.dev')) {
              if (!parsedWrangler.routes) parsedWrangler.routes = []
              const existingRoute = parsedWrangler.routes.find(
                (r: any) => r.pattern === urlObj.hostname,
              )
              if (!existingRoute) {
                parsedWrangler.routes.push({ pattern: urlObj.hostname, custom_domain: true })
              }
            }
          } catch (_e) {}
        }

        await fs.writeFile(wranglerPath, JSON.stringify(parsedWrangler, null, 2) + '\n', 'utf-8')
        console.log(`  ✅ Updated apps/${appDir}/wrangler.json`)
      } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Write GSC HTML file verification token into `apps/web/public/` so the first
 * deploy serves it at `/{filename}`. Values come from `GITHUB_ENV` after
 * `4-create-analytics.ts` runs in CI.
 */
async function writeGscVerificationHtml(targetDir: string): Promise<void> {
  const rawName = process.env.GSC_VERIFICATION_FILE?.trim()
  const content = process.env.GSC_VERIFICATION_CONTENT
  if (!rawName || content === undefined || content === '') {
    return
  }

  const base = path.basename(rawName)
  if (base !== rawName) {
    console.warn('  ⚠️ GSC_VERIFICATION_FILE was not a plain filename; using basename only.')
  }
  if (base.length > 128 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.html$/i.test(base)) {
    console.warn(`  ⚠️ Skipping GSC verification file: invalid or unsafe filename (${base})`)
    return
  }

  const publicDir = path.join(targetDir, 'apps', 'web', 'public')
  await fs.mkdir(publicDir, { recursive: true })
  const outPath = path.join(publicDir, base)
  await fs.writeFile(outPath, content, 'utf-8')
  console.log(`  ✅ Wrote GSC HTML verification file apps/web/public/${base}`)
}

async function scaffoldIndexVue(targetDir: string, displayName: string) {
  const appIndexPath = path.join(targetDir, 'apps', 'web', 'app', 'pages', 'index.vue')
  try {
    const exists = await fs
      .stat(appIndexPath)
      .then(() => true)
      .catch(() => false)
    if (exists) {
      console.log('  ⏭ apps/web/app/pages/index.vue already exists — skipping scaffold.')
      return
    }

    const lines = [
      '<script setup lang="ts">',
      '// ───────────────────────────────────────────────────────────────────────────',
      `// HOME PAGE — ${displayName}`,
      '// ───────────────────────────────────────────────────────────────────────────',
      '// This file was scaffolded by provisioning pipeline.',
      '// Replace everything below with your home page.',
      '// ───────────────────────────────────────────────────────────────────────────',
      '',
      'useSeo({',
      `  title: '${displayName}',`,
      `  description: '${displayName} — built with Nuxt 4 and Cloudflare Workers.',`,
      '  ogImage: {',
      `    title: '${displayName}',`,
      `    description: '${displayName}',`,
      "    icon: '\uD83D\uDE80',",
      '  },',
      '})',
      '',
      'useWebPageSchema({',
      `  name: '${displayName}',`,
      `  description: '${displayName}',`,
      '})',
      '</script>',
      '',
      '<template>',
      '  <UPage>',
      '    <UPageHero',
      `      title="${displayName}"`,
      '      description="Your app is ready. Edit apps/web/app/pages/index.vue to build your home page."',
      '    >',
      '      <template #links>',
      '        <UButton icon="i-lucide-pencil" to="/">Get Started</UButton>',
      '      </template>',
      '    </UPageHero>',
      '  </UPage>',
      '</template>',
      '',
    ]
    await fs.mkdir(path.dirname(appIndexPath), { recursive: true })
    await fs.writeFile(appIndexPath, lines.join('\n'), 'utf-8')
    console.log('  ✅ Scaffolded apps/web/app/pages/index.vue')
  } catch (e: any) {
    console.warn(`  ⚠️ Could not scaffold home page: ${e.message}`)
  }
}

async function configureGitHooks(targetDir: string): Promise<void> {
  const installerPath = path.join(targetDir, 'tools', 'install-git-hooks.cjs')
  const installerExists = await fs
    .stat(installerPath)
    .then(() => true)
    .catch(() => false)

  if (!installerExists) {
    console.log('  ⏭ Skipped git hooks: tools/install-git-hooks.cjs not found.')
    return
  }

  const gitCheck = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: targetDir,
    stdio: 'ignore',
  })

  if (gitCheck.status !== 0) {
    console.log('  ⏭ Skipped git hooks: target is not a git worktree yet.')
    return
  }

  const installHooks = spawnSync(process.execPath, ['tools/install-git-hooks.cjs'], {
    cwd: targetDir,
    stdio: 'inherit',
  })

  if (installHooks.status !== 0) {
    console.warn(`  ⚠️ Git hook setup exited with status ${installHooks.status ?? 'unknown'}.`)
  }
}

async function main() {
  const TARGET_DIR = process.argv.find((a) => a.startsWith('--target-dir='))?.split('=')[1]
  const APP_NAME = process.argv.find((a) => a.startsWith('--app-name='))?.split('=')[1]
  const DISPLAY_NAME = process.argv.find((a) => a.startsWith('--display-name='))?.split('=')[1]
  const SITE_URL = process.argv.find((a) => a.startsWith('--app-url='))?.split('=')[1]
  const APP_DESCRIPTION = process.argv
    .find((a) => a.startsWith('--app-description='))
    ?.split('=')[1]

  if (!TARGET_DIR || !APP_NAME || !DISPLAY_NAME || !SITE_URL) {
    throw new Error('--target-dir, --app-name, --display-name, and --app-url are required')
  }

  const targetAbsDir = path.resolve(TARGET_DIR)
  const resolvedDescription = resolveAppDescription(DISPLAY_NAME, APP_DESCRIPTION)
  console.log(`\n💧 Hydrating repository in: ${targetAbsDir}`)

  console.log(`\nStep 1: Applying placeholders...`)
  await applyStarterPlaceholders(targetAbsDir, {
    APP_NAME,
    DISPLAY_NAME,
    SITE_URL,
    APP_DESCRIPTION: resolvedDescription,
  })
  await writeProvisionMetadata(targetAbsDir, {
    APP_NAME,
    DISPLAY_NAME,
    SITE_URL,
    APP_DESCRIPTION: resolvedDescription,
  })
  await seedSpecDocument(targetAbsDir, {
    APP_NAME,
    DISPLAY_NAME,
    SITE_URL,
    APP_DESCRIPTION: resolvedDescription,
  })

  console.log(`\nStep 2: Linking wrangler.json...`)
  await linkWrangler(targetAbsDir, APP_NAME, SITE_URL)

  console.log(`\nStep 2b: GSC HTML verification (if GITHUB_ENV from analytics)...`)
  await writeGscVerificationHtml(targetAbsDir)

  console.log(`\nStep 3: Scaffolding local dev files...`)
  const dopplerYamlPath = path.join(targetAbsDir, 'doppler.yaml')
  await fs.writeFile(dopplerYamlPath, `setup:\n  project: ${APP_NAME}\n  config: dev\n`, 'utf-8')
  console.log('  ✅ Wrote doppler.yaml')

  await scaffoldIndexVue(targetAbsDir, DISPLAY_NAME)

  console.log(`\nStep 4: Writing setup sentinels...`)
  await fs.writeFile(
    path.join(targetAbsDir, '.setup-complete'),
    `initialized=${new Date().toISOString()}\napp=${APP_NAME}\n`,
    'utf-8',
  )
  await fs.writeFile(
    path.join(targetAbsDir, '.template-version'),
    `template=narduk-nuxt-template\nspawned=${new Date().toISOString()}\napp=${APP_NAME}\n`,
    'utf-8',
  )

  console.log(`\nStep 5: Generating favicons...`)
  // Assuming pnpm install was run in the caller workflow before this script execution, or is run inside the target repo before
  try {
    const webFaviconSvg = path.join(targetAbsDir, 'apps', 'web', 'public', 'favicon.svg')
    if (
      await fs
        .stat(webFaviconSvg)
        .then(() => true)
        .catch(() => false)
    ) {
      spawnSync('pnpm', ['add', '-w', '--save-dev', 'sharp'], {
        cwd: targetAbsDir,
        stdio: 'inherit',
      })
      spawnSync(
        'pnpm',
        [
          'exec',
          'tsx',
          'tools/generate-favicons.ts',
          `--target=apps/web/public`,
          `--name=${DISPLAY_NAME}`,
          `--short-name=${DISPLAY_NAME.slice(0, 12)}`,
        ],
        { cwd: targetAbsDir, stdio: 'inherit' },
      )
      console.log('  ✅ Favicon assets generated.')
    }
  } catch (e: any) {
    console.warn(`  ⚠️ Favicon generation failed: ${e.message}`)
  }

  console.log(`\nStep 6: Setting git hooks...`)
  await configureGitHooks(targetAbsDir)

  console.log('\n✅ Repo hydration complete.')
}

main().catch((err) => {
  console.error('❌ Repo hydration failed:', err)
  process.exit(1)
})
