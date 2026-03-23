#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { auditRepoGuardrails } from './guardrails'
import { resolveFleetAppDir, resolveFleetTargets } from './fleet-projects'

interface FleetGuardrailAuditResult {
  project: string
  root: string
  ok: boolean
  fail: number
  warn: number
  findings: ReturnType<typeof auditRepoGuardrails>['findings']
}

interface FleetGuardrailAuditReport {
  checkedAt: string
  appsDir: string
  source: string
  ok: boolean
  summary: {
    apps: number
    passing: number
    failing: number
    findings: number
  }
  results: FleetGuardrailAuditResult[]
}

function parseProjects(): string[] {
  return process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--projects='))
    .flatMap((arg) =>
      arg
        .slice('--projects='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    )
}

function writeFleetArtifact(report: FleetGuardrailAuditReport, outputDir: string) {
  mkdirSync(outputDir, { recursive: true })
  const timestamp = report.checkedAt.replaceAll(':', '-')
  const payload = JSON.stringify(report, null, 2) + '\n'

  writeFileSync(join(outputDir, `${timestamp}.json`), payload, 'utf-8')
  writeFileSync(join(outputDir, 'latest.json'), payload, 'utf-8')
}

async function main() {
  const templateRoot = resolve(process.cwd())
  const explicitProjects = parseProjects()
  const { repos, source } = await resolveFleetTargets({
    explicit: explicitProjects,
    envValue: process.env.FLEET_PROJECTS,
    log: (message) => console.log(message),
  })
  const appsDir = resolve(process.env.FLEET_APPS_DIR || join(templateRoot, '..', 'template-apps'))

  const results: FleetGuardrailAuditResult[] = []
  for (const project of repos) {
    const root = resolveFleetAppDir(appsDir, project)
    if (!existsSync(root)) {
      results.push({
        project,
        root,
        ok: false,
        fail: 1,
        warn: 0,
        findings: [
          {
            ruleId: 'local-clone',
            severity: 'fail',
            message: `Local clone not found: ${root}`,
          },
        ],
      })
      continue
    }

    const report = auditRepoGuardrails(root)
    results.push({
      project,
      root,
      ok: report.ok,
      fail: report.summary.fail,
      warn: report.summary.warn,
      findings: report.findings,
    })
  }

  const summary = results.reduce(
    (acc, result) => {
      acc.findings += result.findings.length
      if (result.ok) {
        acc.passing += 1
      } else {
        acc.failing += 1
      }
      return acc
    },
    { apps: results.length, passing: 0, failing: 0, findings: 0 },
  )

  const report: FleetGuardrailAuditReport = {
    checkedAt: new Date().toISOString(),
    appsDir,
    source,
    ok: summary.failing === 0,
    summary,
    results,
  }

  writeFleetArtifact(report, join(templateRoot, 'artifacts', 'fleet-guardrails'))

  console.log('')
  console.log(`Fleet guardrails — ${summary.apps} app(s) from ${source}`)
  console.log('═'.repeat(72))
  for (const result of results) {
    const status = result.ok ? 'PASS' : 'FAIL'
    console.log(
      `  ${status.padEnd(4)} ${result.project.padEnd(30)} fail=${String(result.fail).padEnd(3)} warn=${result.warn}`,
    )
  }

  const failing = results.filter((result) => !result.ok)
  if (failing.length > 0) {
    console.log('')
    console.log('Failing apps:')
    for (const result of failing) {
      for (const finding of result.findings) {
        console.log(
          `  ${result.project}: [${finding.severity}] ${finding.ruleId} — ${finding.message}`,
        )
        for (const detail of finding.detail || []) {
          console.log(detail)
        }
      }
    }
  }

  process.exit(report.ok ? 0 : 1)
}

main().catch((error: any) => {
  console.error(error?.stack || error?.message || error)
  process.exit(1)
})
