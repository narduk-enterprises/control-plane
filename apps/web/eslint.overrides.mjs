// Necessary: import-x resolver does not see @playwright/test named exports (test, expect); they are valid exports.
// Necessary: rule normalizes native <ul> to UL and flags it; allow UL as known component.
export default [
  {
    files: ['tests/e2e/**/*.ts'],
    rules: { 'import-x/named': 'off' },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'narduk/no-unknown-nuxt-ui-component': ['error', { additionalComponents: ['UL'] }],
    },
  },
]
