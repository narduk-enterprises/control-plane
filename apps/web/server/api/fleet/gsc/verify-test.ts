import { googleApiFetch } from '#layer/server/utils/google'

export default defineEventHandler(async (_event) => {
  try {
    const siteUrl = `sc-domain:neon-sewer-raid.nard.uk`
    const data = await googleApiFetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
      ['https://www.googleapis.com/auth/webmasters'],
      { method: 'PUT' },
    )
    return { success: true, data }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})
