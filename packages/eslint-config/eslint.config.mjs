// @ts-check
// Shared ESLint configuration for the narduk monorepo.
// Each consuming project wraps this with its own `withNuxt()` from `.nuxt/eslint.config.mjs`.

import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
// Custom ESLint plugins
import nuxtUI from './eslint-plugin-nuxt-ui/dist/index.js'
import nuxtGuardrails from './eslint-plugin-nuxt-guardrails/dist/index.js'
import vueOfficialBestPractices from './eslint-plugin-vue-official-best-practices/dist/index.js'
import atx from './eslint-plugins/index.mjs'
// Community ESLint plugins
import importX from 'eslint-plugin-import-x'
import unicorn from 'eslint-plugin-unicorn'
import security from 'eslint-plugin-security'
import regexp from 'eslint-plugin-regexp'

/**
 * Shared ESLint flat config array.
 * Usage in a consuming project:
 *
 *   import withNuxt from './.nuxt/eslint.config.mjs'
 *   import { sharedConfigs } from '@narduk/eslint-config'
 *   export default withNuxt(...sharedConfigs)
 */
// Re-export the atx plugin so consuming apps can reference it in their own
// config objects when overriding atx rule severities.
export { default as atxPlugin } from './eslint-plugins/index.mjs'

export const sharedConfigs = [
  // Vue files: use vue-eslint-parser with TypeScript parser for script blocks
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.mts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
      },
    },
  },

  // Disable all stylistic/formatting rules - Prettier handles formatting
  eslintConfigPrettier,

  // ATX design-system rules (all .vue files)
  ...atx.configs.recommended,

  // ATX app architecture (composables, utils, stores)
  ...atx.configs.app,

  // ATX server safety rules (server/**/*.ts)
  ...atx.configs.server,

  // Global ignores
  {
    ignores: ['.nuxt/**', '.output/**', 'dist/**', 'node_modules/**', '**/*.d.ts', 'scripts/**'],
  },

  // TypeScript files - disable base no-unused-vars for interfaces
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  // Vue rules that override or extend @nuxt/eslint defaults
  {
    files: ['**/*.vue'],
    rules: {
      // Enforce PascalCase for all components in templates
      'vue/component-name-in-template-casing': [
        'warn',
        'PascalCase',
        { registeredComponentsOnly: false },
      ],

      // Composition API preferences
      'vue/prefer-define-options': 'warn',
      'vue/prefer-import-from-vue': 'warn',

      // Code organisation
      'vue/block-order': ['warn', { order: ['script', 'template', 'style'] }],
      'vue/attributes-order': 'off',

      // Relaxations (Nuxt 4 / Vue 3 specifics)
      'vue/no-multiple-template-root': 'off',
      'vue/no-v-for-template-key': 'off',
      'vue/no-v-html': 'warn',
    },
  },

  // Project-specific rules (uses @typescript-eslint registered by @nuxt/eslint)
  {
    rules: {
      'no-unused-vars': 'off',
      'no-debugger': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // ── Nuxt UI component validation ──────────────────────────────
  {
    files: ['**/*.vue'],
    plugins: {
      'nuxt-ui': nuxtUI,
    },
    rules: {
      ...nuxtUI.configs.recommended.rules,
    },
  },

  // ── Nuxt Guardrails plugin ────────────────────────────────────
  {
    plugins: {
      'nuxt-guardrails': nuxtGuardrails,
    },
    rules: {
      ...nuxtGuardrails.configs.recommended.rules,
    },
  },

  // ── Vue Official Best Practices plugin ────────────────────────
  {
    plugins: {
      'vue-official': vueOfficialBestPractices,
    },
    rules: {
      ...vueOfficialBestPractices.configs.recommended.rules,
    },
  },

  // Composable helpers are internal utilities, not public composables
  {
    files: ['app/composables/helpers/**/*.ts'],
    rules: {
      'vue-official/require-use-prefix-for-composables': 'off',
    },
  },

  // ── Import ordering & hygiene (eslint-plugin-import-x) ────────
  {
    files: ['**/*.ts', '**/*.mts', '**/*.vue'],
    plugins: {
      'import-x': importX,
    },
    rules: {
      'import-x/no-duplicates': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'warn',
      'import-x/first': 'warn',
      'import-x/newline-after-import': 'warn',
      'import-x/no-mutable-exports': 'error',
    },
  },

  // ── Modern JS best practices (cherry-picked from unicorn) ─────
  {
    files: ['**/*.ts', '**/*.mts', '**/*.vue'],
    plugins: {
      unicorn,
    },
    rules: {
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/no-array-for-each': 'warn',
      'unicorn/prefer-at': 'warn',
      'unicorn/no-useless-undefined': 'warn',
      'unicorn/prefer-string-replace-all': 'warn',
      'unicorn/prefer-number-properties': 'warn',
      'unicorn/no-lonely-if': 'warn',
      'unicorn/prefer-array-find': 'warn',
      'unicorn/prefer-includes': 'warn',
      'unicorn/no-instanceof-array': 'error',
      'unicorn/throw-new-error': 'error',
    },
  },

  // ── Security rules for server-side code ────────────────────────
  {
    files: ['server/**/*.ts'],
    plugins: {
      security,
    },
    rules: {
      'security/detect-object-injection': 'off', // too noisy for bracket access
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
    },
  },

  // ── Regex validation (eslint-plugin-regexp) ────────────────────
  regexp.configs['flat/recommended'],
]
