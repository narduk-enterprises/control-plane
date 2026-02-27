/**
 * ESLint plugin for Nuxt 4 guardrails
 */

import noLegacyHead from './rules/no-legacy-head'
import noLegacyFetchHook from './rules/no-legacy-fetch-hook'
import preferImportMetaClient from './rules/prefer-import-meta-client'
import noSsrDomAccess from './rules/no-ssr-dom-access'
import validUseAsyncData from './rules/valid-useAsyncData'
import validUseFetch from './rules/valid-useFetch'
import appStructureConsistency from './rules/app-structure-consistency'

export default {
  meta: {
    name: 'eslint-plugin-nuxt-guardrails',
    version: '1.0.0',
  },
  rules: {
    'no-legacy-head': noLegacyHead,
    'no-legacy-fetch-hook': noLegacyFetchHook,
    'prefer-import-meta-client': preferImportMetaClient,
    'no-ssr-dom-access': noSsrDomAccess,
    'valid-useAsyncData': validUseAsyncData,
    'valid-useFetch': validUseFetch,
    'app-structure-consistency': appStructureConsistency,
  },
  configs: {
    recommended: {
      plugins: ['nuxt-guardrails'],
      rules: {
        'nuxt-guardrails/no-legacy-head': 'warn',
        'nuxt-guardrails/no-legacy-fetch-hook': 'error',
        'nuxt-guardrails/prefer-import-meta-client': 'warn',
        'nuxt-guardrails/no-ssr-dom-access': 'error',
        'nuxt-guardrails/valid-useAsyncData': 'warn',
        'nuxt-guardrails/valid-useFetch': 'warn',
        'nuxt-guardrails/app-structure-consistency': 'warn',
      },
    },
  },
}
