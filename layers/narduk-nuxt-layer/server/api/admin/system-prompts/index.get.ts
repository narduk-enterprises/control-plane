import { requireAdmin } from '../../../utils/auth'
import { getAllSystemPrompts } from '../../../utils/systemPrompts'
import type { AppSystemPromptConfig } from '../../../utils/systemPrompts'

// If the host app defines DEFAULT_PROMPTS via nitro app hooks or runtime config,
// we could use them. For now, we accept an empty struct or wait for the app to override.
// Actually, apps using the generic layer route should provide default prompts via some mapping, 
// or the endpoint simply returns what is in the DB.
// Let's assume the host app hooks in default prompts if needed.
// For now, return the DB contents straight away.
import { useDatabase } from '../../../utils/database'
import { systemPrompts } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDatabase(event)
  
  const existingRows = await db.select().from(systemPrompts).all()
  return existingRows
})
