/**
 * Composable for fleet admin mutations (add, edit, toggle, delete).
 * Uses direct $fetch for one-shot mutations — not useFetch.
 */
export function useFleetAdmin() {
  async function addApp(body: Record<string, unknown>) {
    return $fetch('/api/fleet/apps', {
      method: 'POST',
      body,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  }

  async function toggleApp(appName: string, isActive: boolean) {
    return $fetch(`/api/fleet/apps/${encodeURIComponent(appName)}`, {
      method: 'PUT',
      body: { isActive },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  }

  async function editApp(appName: string, body: Record<string, unknown>) {
    return $fetch(`/api/fleet/apps/${encodeURIComponent(appName)}`, {
      method: 'PUT',
      body,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  }

  async function deleteApp(appName: string, hard: boolean = true) {
    return $fetch(`/api/fleet/apps/${encodeURIComponent(appName)}${hard ? '?hard=true' : ''}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  }

  return { addApp, editApp, toggleApp, deleteApp }
}
