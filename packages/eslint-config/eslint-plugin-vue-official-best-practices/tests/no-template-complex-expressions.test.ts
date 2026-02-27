import * as tsParser from '@typescript-eslint/parser'
/**
 * Tests for no-template-complex-expressions rule
 */

import { RuleTester } from 'eslint'
import rule from '../src/rules/no-template-complex-expressions'
import vueParser from 'vue-eslint-parser'

import { describe, it, afterAll } from 'vitest'
RuleTester.describe = describe
RuleTester.it = it
RuleTester.afterAll = afterAll

const ruleTester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
      parser: tsParser,
    },
  },
})

ruleTester.run('no-template-complex-expressions', rule, {
  valid: [
    {
      filename: 'test.vue',
      code: `
        <template>
          <div>{{ count }}</div>
        </template>
      `,
    },
    {
      filename: 'test.vue',
      code: `
        <template>
          <div>{{ formatPrice(price) }}</div>
        </template>
      `,
    },
  ],
  invalid: [
    {
      filename: 'test.vue',
      code: `
        <template>
          <div>{{ a ? b ? c : d : e }}</div>
        </template>
      `,
      errors: [
        {
          messageId: 'complexExpression',
        },
      ],
    },
  ],
})
