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

/**
 * Shared ESLint flat config array.
 * Usage in a consuming project:
 *
 *   import withNuxt from './.nuxt/eslint.config.mjs'
 *   import { sharedConfigs } from '@narduk/eslint-config'
 *   export default withNuxt(...sharedConfigs)
 */
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
    }
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

  // ATX server safety rules (server/**/*.ts)
  ...atx.configs.server,

  // Global ignores
  {
    ignores: [
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      '**/*.d.ts',
      'scripts/**',
    ],
  },

  // TypeScript files - disable base no-unused-vars for interfaces
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  // Vue-specific rules for better code quality
  {
    files: ['**/*.vue'],
    rules: {
      // Component naming and structure
      'vue/component-name-in-template-casing': [
        'warn',
        'PascalCase',
        {
          registeredComponentsOnly: false,
          ignores: [],
        },
      ],

      // Props validation
      'vue/require-default-prop': 'warn',
      'vue/require-prop-type-constructor': 'warn',
      'vue/require-prop-types': 'warn',
      'vue/prop-name-casing': ['warn', 'camelCase'],

      // Template best practices
      'vue/no-v-html': 'warn',
      'vue/no-textarea-mustache': 'error',
      'vue/no-unused-components': 'warn',
      'vue/no-unused-refs': 'warn',
      'vue/no-useless-template-attributes': 'warn',
      'vue/no-useless-v-bind': 'warn',

      // Composition API best practices
      'vue/prefer-define-options': 'warn',
      'vue/prefer-import-from-vue': 'warn',

      // Performance
      'vue/no-v-for-template-key-on-child': 'error',
      'vue/no-use-v-if-with-v-for': 'error',
      'vue/no-multiple-template-root': 'off',
      'vue/require-v-for-key': 'error',

      // Code quality
      'vue/block-order': [
        'warn',
        {
          order: ['script', 'template', 'style'],
        },
      ],
      'vue/attributes-order': 'off',

      // Prevent common mistakes
      'vue/no-async-in-computed-properties': 'error',
      'vue/no-dupe-keys': 'error',
      'vue/no-duplicate-attributes': 'error',
      'vue/no-parsing-error': 'error',
      'vue/no-ref-as-operand': 'error',
      'vue/no-reserved-component-names': 'error',
      'vue/no-shared-component-data': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',
      'vue/no-template-key': 'warn',
      'vue/no-v-for-template-key': 'off',
      'vue/require-component-is': 'error',
      'vue/require-render-return': 'error',
      'vue/return-in-computed-property': 'error',
      'vue/return-in-emits-validator': 'error',
      'vue/use-v-on-exact': 'warn',
      'vue/valid-template-root': 'error',
      'vue/valid-v-bind': 'error',
      'vue/valid-v-cloak': 'error',
      'vue/valid-v-else-if': 'error',
      'vue/valid-v-else': 'error',
      'vue/valid-v-for': 'error',
      'vue/valid-v-html': 'error',
      'vue/valid-v-if': 'error',
      'vue/valid-v-is': 'error',
      'vue/valid-v-memo': 'error',
      'vue/valid-v-model': 'error',
      'vue/valid-v-on': 'error',
      'vue/valid-v-once': 'error',
      'vue/valid-v-pre': 'error',
      'vue/valid-v-show': 'error',
      'vue/valid-v-slot': 'error',
      'vue/valid-v-text': 'error',
    },
  },

  // Project-specific rules
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-unused-vars': 'off',
      'no-debugger': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
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
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
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
  }
]
