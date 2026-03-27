import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const MAX_SHORT_DESCRIPTION_LENGTH = 280

function escapeForSingleQuotedCodeLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/'/g, "\\'")
}

function escapeForHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function resolveAgentDescription(
  displayName: string,
  appDescription?: string,
  shortDescription?: string,
): string {
  const trimmed = appDescription?.trim()
  if (trimmed) {
    return trimmed
  }

  const trimmedShort = shortDescription?.trim()
  if (trimmedShort) {
    return trimmedShort
  }

  return `${displayName} — powered by Nuxt 4 and Cloudflare Workers.`
}

const DEFAULT_TEMPLATE_FIRST_GUARDRAILS = [
  'Do not reinvent platform primitives. Before adding new auth, session, CSRF, analytics, SEO, OG images, rate limiting, mutation helpers, or DB access patterns:',
  '',
  'Auth: Use the template / layer auth (session, login/register routes, guards, useUser-style composables) exactly as shipped. Extend with new tables and route rules, not a parallel auth stack.',
  'Maps / geo (if needed): Use first-class template or layer integrations (e.g. documented map components, env keys, server utilities). Do not embed a new map SDK or geocoder unless the template has no path and SPEC explicitly approves an exception.',
  'Data & API: Use useAppDatabase, layer useDatabase rules, withValidatedBody / mutation wrappers, #server/ imports, and existing D1 + Drizzle patterns.',
  'UI & SEO: Use Nuxt UI v4, useSeo + Schema.org helpers, useFetch / useAsyncData (no raw $fetch in pages). Reuse OgImage templates from the layer where applicable.',
  'Analytics / admin patterns: Wire through existing PostHog, GA, or admin patterns if the template already exposes them; do not duplicate trackers or admin APIs.',
  'If something is missing, extend the layer only when the feature is reusable across apps; otherwise keep changes in apps/web/ and still call into layer utilities.',
].join('\n')

type ProvisionBriefSectionKey =
  | 'product'
  | 'p1'
  | 'coreScope'
  | 'expandedScope'
  | 'pages'
  | 'nonFunctional'
  | 'guardrails'

type ProvisionBriefSections = Partial<Record<ProvisionBriefSectionKey, string>>

const PROVISION_BRIEF_SECTION_ALIASES: Record<string, ProvisionBriefSectionKey> = {
  product: 'product',
  'p1 (must ship in v1)': 'p1',
  'core recipe features (in scope)': 'coreScope',
  'core features (in scope)': 'coreScope',
  'expanded scope (previously "out of scope"-now in scope)': 'expandedScope',
  "expanded scope (previously 'out of scope'-now in scope)": 'expandedScope',
  'pages / routes (indicative)': 'pages',
  'pages/routes (indicative)': 'pages',
  'non-functional summary': 'nonFunctional',
  'implementation guardrails - use the template first': 'guardrails',
  guardrails: 'guardrails',
}

const NON_USER_FLOW_PREFIXES = [
  /^seo\b/i,
  /^performance\b/i,
  /^security\b/i,
  /^accessibility\b/i,
  /^observability\b/i,
]

function normalizeProvisionHeading(value: string): string {
  return value
    .replace(/^#+\s*/, '')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/:+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function compactBlankLines(value: string): string {
  return value.trim().replace(/\n{3,}/g, '\n\n')
}

function summarizeProvisionDescription(description?: string): string {
  const trimmed = description?.trim()
  if (!trimmed) {
    return ''
  }

  const sections = extractProvisionBriefSections(trimmed)
  const summarySource = sections.product || trimmed
  const summary = summarySource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (summary.length <= MAX_SHORT_DESCRIPTION_LENGTH) {
    return summary
  }

  return `${summary.slice(0, MAX_SHORT_DESCRIPTION_LENGTH - 3).trimEnd()}...`
}

function resolveShortDescription(
  displayName: string,
  shortDescription?: string,
  appDescription?: string,
): string {
  const trimmed = shortDescription?.trim()
  if (trimmed) {
    return trimmed
  }

  const summarized = summarizeProvisionDescription(appDescription)
  if (summarized) {
    return summarized
  }

  return `${displayName} — powered by Nuxt 4 and Cloudflare Workers.`
}

function extractProvisionBriefSections(description: string): ProvisionBriefSections {
  const buckets: Record<ProvisionBriefSectionKey, string[]> = {
    product: [],
    p1: [],
    coreScope: [],
    expandedScope: [],
    pages: [],
    nonFunctional: [],
    guardrails: [],
  }
  const prelude: string[] = []
  let currentSection: ProvisionBriefSectionKey | null = null
  let matchedHeading = false

  for (const line of description.split(/\r?\n/)) {
    const normalized = normalizeProvisionHeading(line)
    const nextSection = PROVISION_BRIEF_SECTION_ALIASES[normalized]

    if (nextSection) {
      currentSection = nextSection
      matchedHeading = true
      continue
    }

    if (!matchedHeading) {
      prelude.push(line)
      continue
    }

    if (currentSection) {
      buckets[currentSection].push(line)
    }
  }

  const sections = Object.fromEntries(
    Object.entries(buckets)
      .map(([key, lines]) => [key, compactBlankLines(lines.join('\n'))])
      .filter(([, value]) => Boolean(value)),
  ) as ProvisionBriefSections

  if (!matchedHeading) {
    return { product: compactBlankLines(description) }
  }

  const preludeContent = compactBlankLines(prelude.join('\n'))
  if (preludeContent && !sections.product) {
    sections.product = preludeContent
  }

  return sections
}

function dedupeOrdered(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = value.toLowerCase()
    if (seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(value)
  }

  return result
}

function normalizeFlowLine(line: string): string {
  return line
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim()
}

function buildSpecUserFlows(sections: ProvisionBriefSections): string {
  const candidateLines = dedupeOrdered(
    [sections.p1, sections.coreScope, sections.expandedScope]
      .filter(Boolean)
      .flatMap((section) => section!.split('\n'))
      .map((line) => normalizeFlowLine(line))
      .filter((line) => Boolean(line))
      .filter((line) => !NON_USER_FLOW_PREFIXES.some((pattern) => pattern.test(line))),
  ).slice(0, 8)

  if (candidateLines.length === 0) {
    return [
      '1. Review the product brief, lock the first end-to-end workflow in SPEC, and confirm the implementation order before building.',
      '2. Expand secondary journeys, error states, and privileged/admin flows during the downstream agent workflow.',
    ].join('\n\n')
  }

  return candidateLines.map((line, index) => `${index + 1}. ${line}`).join('\n\n')
}

function buildSpecSections(description: string): {
  product: string
  inScope: string
  userFlows: string
  pages?: string
  nonFunctional: string
} {
  const sections = extractProvisionBriefSections(description)
  const inScopeBlocks = [
    sections.p1 ? `### P1 (must ship in v1)\n\n${sections.p1}` : '',
    sections.coreScope ? `### Core features\n\n${sections.coreScope}` : '',
    sections.expandedScope ? `### Expanded scope\n\n${sections.expandedScope}` : '',
  ].filter(Boolean)

  const nonFunctionalBlocks = [
    sections.nonFunctional ? `### Non-functional summary\n\n${sections.nonFunctional}` : '',
    `### Guardrails\n\n${sections.guardrails || DEFAULT_TEMPLATE_FIRST_GUARDRAILS}`,
  ].filter(Boolean)

  return {
    product: sections.product || compactBlankLines(description),
    inScope: inScopeBlocks.join('\n\n') || '- (fill during agent workflow)',
    userFlows: buildSpecUserFlows(sections),
    pages: sections.pages,
    nonFunctional: nonFunctionalBlocks.join('\n\n'),
  }
}

function replaceMarkdownSection(content: string, heading: string, body: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sectionPattern = new RegExp(`(^## ${escapedHeading}\\n\\n)([\\s\\S]*?)(?=\\n## |$)`, 'm')
  const normalizedBody = body.trim()

  if (sectionPattern.test(content)) {
    return content.replace(sectionPattern, (_match, prefix) => `${prefix}${normalizedBody}\n`)
  }

  return `${content.trimEnd()}\n\n## ${heading}\n\n${normalizedBody}\n`
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
  let changedFiles = 0
  for (const relativePath of STARTER_PLACEHOLDER_FILES) {
    const absolutePath = path.join(targetDir, relativePath)
    try {
      const original = await fs.readFile(absolutePath, 'utf-8')
      let content = original
      const encodePlaceholder =
        relativePath === 'apps/web/nuxt.config.ts'
          ? escapeForSingleQuotedCodeLiteral
          : (value: string) => value
      const starterReplacements = [
        { from: /__APP_NAME__/g, to: encodePlaceholder(req.APP_NAME) },
        { from: /__DISPLAY_NAME__/g, to: encodePlaceholder(req.DISPLAY_NAME) },
        { from: /__SITE_URL__/g, to: encodePlaceholder(req.SITE_URL) },
        {
          from: /__APP_DESCRIPTION__/g,
          to: encodePlaceholder(req.APP_SHORT_DESCRIPTION),
        },
      ]
      for (const replacement of starterReplacements) {
        content = content.replace(replacement.from, () => replacement.to)
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
    shortDescription: req.APP_SHORT_DESCRIPTION,
    description: req.APP_DESCRIPTION,
    url: req.SITE_URL,
    provisionedAt,
  }

  try {
    const raw = await fs.readFile(provisionPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const stringFields = Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'string'),
    ) as Record<string, string>
    payload = {
      ...stringFields,
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
  const seededSections = buildSpecSections(req.APP_DESCRIPTION)
  const fallback = [
    'Status: DRAFT',
    '',
    `# ${req.DISPLAY_NAME}`,
    '',
    `Source: provision.json (${req.APP_NAME})`,
    '',
    '## Product',
    '',
    seededSections.product,
    '',
    '## In scope',
    '',
    seededSections.inScope,
    '',
    '## Out of scope',
    '',
    '- (fill during agent workflow)',
    '',
    '## User flows',
    '',
    seededSections.userFlows,
    '',
    '## Conceptual data model',
    '',
    '- ',
    '',
    '## Pages / routes',
    '',
    seededSections.pages || '- ',
    '',
    '## Non-functional',
    '',
    seededSections.nonFunctional,
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

  content = replaceMarkdownSection(content, 'Product', seededSections.product)
  content = replaceMarkdownSection(content, 'In scope', seededSections.inScope)
  content = replaceMarkdownSection(content, 'User flows', seededSections.userFlows)
  content = replaceMarkdownSection(content, 'Non-functional', seededSections.nonFunctional)

  if (seededSections.pages) {
    content = replaceMarkdownSection(content, 'Pages / routes', seededSections.pages)
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

        const kvProd = process.env.KV_NAMESPACE_ID?.trim()
        const kvPreview = process.env.KV_PREVIEW_NAMESPACE_ID?.trim()
        if (
          kvProd &&
          kvPreview &&
          Array.isArray(parsedWrangler.kv_namespaces) &&
          parsedWrangler.kv_namespaces.length > 0
        ) {
          const kvEntry = parsedWrangler.kv_namespaces.find(
            (n: { binding?: string }) => n && typeof n === 'object' && n.binding === 'KV',
          ) as { binding?: string; id?: string; preview_id?: string } | undefined
          if (kvEntry) {
            kvEntry.id = kvProd
            kvEntry.preview_id = kvPreview
          }
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

    const displayNameLiteral = JSON.stringify(displayName)
    const defaultDescriptionLiteral = JSON.stringify(
      `${displayName} — built with Nuxt 4 and Cloudflare Workers.`,
    )
    const escapedDisplayNameAttribute = escapeForHtmlAttribute(displayName)
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
      `  title: ${displayNameLiteral},`,
      `  description: ${defaultDescriptionLiteral},`,
      '  ogImage: {',
      `    title: ${displayNameLiteral},`,
      `    description: ${displayNameLiteral},`,
      "    icon: '\uD83D\uDE80',",
      '  },',
      '})',
      '',
      'useWebPageSchema({',
      `  name: ${displayNameLiteral},`,
      `  description: ${displayNameLiteral},`,
      '})',
      '</script>',
      '',
      '<template>',
      '  <UPage>',
      '    <UPageHero',
      `      title="${escapedDisplayNameAttribute}"`,
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
  const getArg = (name: string): string | undefined => {
    const prefix = `--${name}=`
    const arg = process.argv.find((value) => value.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : undefined
  }

  const TARGET_DIR = getArg('target-dir')
  const APP_NAME = getArg('app-name')
  const DISPLAY_NAME = getArg('display-name')
  const SITE_URL = getArg('app-url')
  const APP_SHORT_DESCRIPTION = getArg('app-short-description')
  const APP_DESCRIPTION = getArg('app-description')

  if (!TARGET_DIR || !APP_NAME || !DISPLAY_NAME || !SITE_URL) {
    throw new Error('--target-dir, --app-name, --display-name, and --app-url are required')
  }

  const targetAbsDir = path.resolve(TARGET_DIR)
  const resolvedDescription = resolveAgentDescription(
    DISPLAY_NAME,
    APP_DESCRIPTION,
    APP_SHORT_DESCRIPTION,
  )
  const resolvedShortDescription = resolveShortDescription(
    DISPLAY_NAME,
    APP_SHORT_DESCRIPTION,
    resolvedDescription,
  )
  console.log(`\n💧 Hydrating repository in: ${targetAbsDir}`)

  console.log(`\nStep 1: Applying placeholders...`)
  await applyStarterPlaceholders(targetAbsDir, {
    APP_NAME,
    DISPLAY_NAME,
    SITE_URL,
    APP_SHORT_DESCRIPTION: resolvedShortDescription,
    APP_DESCRIPTION: resolvedDescription,
  })
  await writeProvisionMetadata(targetAbsDir, {
    APP_NAME,
    DISPLAY_NAME,
    SITE_URL,
    APP_SHORT_DESCRIPTION: resolvedShortDescription,
    APP_DESCRIPTION: resolvedDescription,
  })
  await seedSpecDocument(targetAbsDir, {
    APP_NAME,
    DISPLAY_NAME,
    SITE_URL,
    APP_SHORT_DESCRIPTION: resolvedShortDescription,
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
