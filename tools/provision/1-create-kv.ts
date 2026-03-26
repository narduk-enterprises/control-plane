import fs from 'node:fs'
import { createKvNamespace } from '../../apps/web/server/utils/provision-cloudflare'

function kvTitles(appName: string) {
  return {
    productionTitle: `${appName}-kv`,
    previewTitle: `${appName}-kv-preview`,
  }
}

async function main() {
  const APP_NAME = process.argv.find((a) => a.startsWith('--app-name='))?.split('=')[1]
  if (!APP_NAME) throw new Error('--app-name is required')

  const existingProd = process.env.KV_NAMESPACE_ID?.trim()
  const existingPreview = process.env.KV_PREVIEW_NAMESPACE_ID?.trim()

  if (existingProd && existingPreview) {
    console.log(`Reusing existing KV namespaces: prod=${existingProd} preview=${existingPreview}`)
    if (process.env.GITHUB_ENV) {
      fs.appendFileSync(process.env.GITHUB_ENV, `KV_NAMESPACE_ID=${existingProd}\n`)
      fs.appendFileSync(process.env.GITHUB_ENV, `KV_PREVIEW_NAMESPACE_ID=${existingPreview}\n`)
    }
    return
  }

  if (existingProd || existingPreview) {
    throw new Error(
      'KV_NAMESPACE_ID and KV_PREVIEW_NAMESPACE_ID must both be set for reuse, or neither (to create new namespaces)',
    )
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required in environment')
  }

  const { productionTitle, previewTitle } = kvTitles(APP_NAME)
  console.log(`Provisioning Workers KV namespaces: ${productionTitle}, ${previewTitle}`)

  const prodNs = await createKvNamespace(accountId, apiToken, productionTitle)
  const previewNs = await createKvNamespace(accountId, apiToken, previewTitle)

  console.log(`✅ KV production: ${prodNs.id} (${prodNs.title})`)
  console.log(`✅ KV preview: ${previewNs.id} (${previewNs.title})`)

  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `KV_NAMESPACE_ID=${prodNs.id}\n`)
    fs.appendFileSync(process.env.GITHUB_ENV, `KV_PREVIEW_NAMESPACE_ID=${previewNs.id}\n`)
  }
}

main().catch((err) => {
  console.error('❌ KV provisioning failed:', err)
  process.exit(1)
})
