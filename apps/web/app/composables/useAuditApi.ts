import type { AuditResult } from '~/types/audit'

export function useAuditApi() {
  async function runAudit() {
    return $fetch<AuditResult[]>('/api/fleet/audit', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  }

  return { runAudit }
}
