export interface AuditCheck {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'skipped'
  expected: string | null
  actual: string | null
  message: string
}

export interface AuditResult {
  app: string
  url: string
  checks: AuditCheck[]
  fetchError?: string
}
