import { googleApiFetch } from './layers/narduk-nuxt-layer/server/utils/google'
import { $fetch } from 'ofetch'

async function tryVerify() {
    // Test adding site
    try {
        const res = await $fetch('/api/fleet/gsc/verify-test', {
            baseURL: 'http://localhost:3000'
        })
        console.log(res)
    } catch (e) {
        console.error(e)
    }
}
tryVerify()
