import type { AuditResponse } from '~/types/audit'

export function useAuditApi() {
  async function runAudit(options?: { persist?: boolean }) {
    return $fetch<AuditResponse>('/api/fleet/audit', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: options?.persist ? { persist: true } : undefined,
    })
  }

  return { runAudit }
}
