import fs from 'node:fs'

function escapeWorkflowCommandValue(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

export function maskGitHubValue(value: string): void {
  if (!value) return
  process.stdout.write(`::add-mask::${escapeWorkflowCommandValue(value)}\n`)
}

export function appendGitHubEnv(key: string, value: string): void {
  const githubEnvPath = process.env.GITHUB_ENV
  if (!githubEnvPath) {
    throw new Error('GITHUB_ENV is required to export workflow environment values')
  }

  maskGitHubValue(value)
  const eof = `__GITHUB_ENV_${key}_${Date.now()}__`
  fs.appendFileSync(githubEnvPath, `${key}<<${eof}\n${value}\n${eof}\n`)
}
