import { generateApiKey } from './layers/narduk-nuxt-layer/server/utils/auth.ts'

async function main() {
  const key = await generateApiKey()
  console.log(JSON.stringify(key))
}

main().catch(console.error)
