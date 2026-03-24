import { describe, expect, it } from 'vitest'

import { normalizeGeneratedFiles } from '../../../../tools/provision/theme-generation-normalize'

describe('normalizeGeneratedFiles', () => {
  it('strips always-truthy string fallbacks from generated Vue code', () => {
    const result = normalizeGeneratedFiles({
      appConfig: `export default defineAppConfig({
  ui: {
    title: 'Recipe Library' || ''
  }
})`,
      mainCss: '@theme { --brand: #fff; }',
      indexVue: `<script setup lang="ts">
const appName = 'Recipe Library'

useSeo({
  title: \`${'${appName}'} || ''\`,
  description: 'Save your recipes' || ''
})
</script>`,
      appVue: `<script setup lang="ts">
const title = "Recipe Library" ?? ""
</script>`,
    })

    expect(result.notes).toEqual([
      'appConfig: stripped 1 always-truthy string fallback',
      'indexVue: stripped 2 always-truthy string fallbacks',
      'appVue: stripped 1 always-truthy string fallback',
    ])
    expect(result.files.appConfig).not.toContain(`|| ''`)
    expect(result.files.indexVue).toContain('title: `${appName}`')
    expect(result.files.indexVue).not.toContain(`'Save your recipes' || ''`)
    expect(result.files.appVue).toContain('const title = "Recipe Library"')
  })

  it('leaves valid fallback logic untouched', () => {
    const source = `<script setup lang="ts">
const appName = config.public.appName ? String(config.public.appName) : 'Recipe Library'
const pageTitle = \`${'${appName}'} — Keep every recipe within reach\`
</script>`

    const result = normalizeGeneratedFiles({
      appConfig: '',
      mainCss: '',
      indexVue: source,
      appVue: '',
    })

    expect(result.notes).toEqual([])
    expect(result.files.indexVue).toBe(source)
  })
})
