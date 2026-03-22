import { buildIntegrationHealth, toHttpError } from '#server/utils/fleet-analytics'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    return await buildIntegrationHealth(event)
  } catch (error: unknown) {
    throw toHttpError(error)
  }
})
