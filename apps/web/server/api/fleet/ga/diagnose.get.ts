/**
 * Diagnostic: List all GA4 properties the service account can access.
 * This helps identify whether a property ID belongs to the correct GA account.
 *
 * Usage: GET /api/fleet/ga/diagnose
 */
import { googleApiFetch, GA_SCOPES } from '#layer/server/utils/google'

const ADMIN_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']

export default defineEventHandler(async () => {
    const config = useRuntimeConfig()
    const configuredPropertyId = config.gaPropertyId as string

    // 1. List all GA4 accounts the service account can see
    const accounts = await googleApiFetch(
        'https://analyticsadmin.googleapis.com/v1beta/accounts',
        ADMIN_SCOPES,
    ) as Record<string, unknown>

    const accountList = (accounts.accounts as Array<Record<string, string>>) ?? []

    // 2. For each account, list properties
    const allProperties: Array<{ account: string; propertyId: string; displayName: string; matched: boolean }> = []

    for (const account of accountList) {
        const accountName = account.name ?? ''
        try {
            const props = await googleApiFetch(
                `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${accountName}`,
                ADMIN_SCOPES,
            ) as Record<string, unknown>

            const propList = (props.properties as Array<Record<string, string>>) ?? []
            for (const prop of propList) {
                const numericId = (prop.name ?? '').replace('properties/', '')
                allProperties.push({
                    account: account.displayName ?? accountName,
                    propertyId: numericId,
                    displayName: prop.displayName ?? '(unnamed)',
                    matched: numericId === configuredPropertyId,
                })
            }
        } catch {
            allProperties.push({
                account: account.displayName ?? accountName,
                propertyId: '(error listing)',
                displayName: '(could not list properties)',
                matched: false,
            })
        }
    }

    const matchFound = allProperties.some(p => p.matched)

    return {
        configuredPropertyId,
        matchFound,
        message: matchFound
            ? `✅ Property ${configuredPropertyId} found and accessible.`
            : `❌ Property ${configuredPropertyId} NOT found in any accessible account. It may belong to a different GA account or the service account lacks access.`,
        accessibleAccounts: accountList.length,
        accessibleProperties: allProperties,
    }
})
