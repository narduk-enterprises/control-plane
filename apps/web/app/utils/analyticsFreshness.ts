export function formatAnalyticsFreshness(
  timestamp: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!timestamp) return null

  const updatedAt = new Date(timestamp)
  const updatedAtMs = updatedAt.getTime()
  if (Number.isNaN(updatedAtMs)) return null

  const diffMinutes = Math.max(0, Math.round((now - updatedAtMs) / 60_000))

  if (diffMinutes < 1) return 'Updated just now'
  if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`

  return `Updated ${updatedAt.toLocaleTimeString()}`
}
