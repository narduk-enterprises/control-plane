import { defineEventHandler } from 'h3'
import { z } from 'zod'

const querySchema = z.object({
    url: z.string().url()
})

export default defineEventHandler(async (event) => {
    const query = await getValidatedQuery(event, querySchema.parse)
    const url = query.url

    try {
        // Try a fast HEAD request first
        let response = await fetch(url, { method: 'HEAD', redirect: 'follow' })

        // Some servers reject HEAD requests, fallback to GET
        if (response.status === 405 || response.status >= 500) {
            response = await fetch(url, { method: 'GET', redirect: 'follow' })
        }

        if (response.ok) {
            return { status: 'up', code: response.status }
        } else {
            return { status: 'down', code: response.status }
        }
    } catch (_error) {
        return { status: 'down', code: 0 }
    }
})
