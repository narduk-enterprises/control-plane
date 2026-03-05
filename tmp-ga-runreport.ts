import { googleApiFetch, GA_SCOPES } from './layers/narduk-nuxt-layer/server/utils/google'

globalThis.useRuntimeConfig = () => ({
  googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON
})

async function main() {
  const propertyId = '520350533'
  console.log(`Running Report for properties/${propertyId}...`)
  try {
    const data = await googleApiFetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      GA_SCOPES,
      {
        method: 'POST',
        body: JSON.stringify({
            dateRanges: [{ startDate: '2026-03-04', endDate: '2026-03-04' }],
            metrics: [{ name: 'activeUsers' }]
        })
      }
    )
    console.log('Success!', JSON.stringify(data, null, 2))
  } catch (err: any) {
    console.error('Data API Error:', err.status, err.message)
    console.error('Body:', err.body)
  }
}
main()
