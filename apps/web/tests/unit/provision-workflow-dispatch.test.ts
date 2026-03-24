import { describe, it, expect } from 'vitest'
import {
  buildProvisionWorkflowDispatchInputs,
  mergeDispatchInputs,
  parseStoredDispatchInputs,
  dispatchInputsForRetry,
  PROVISION_WORKFLOW_INPUT_KEYS,
} from '../../server/utils/provision-workflow-dispatch'

describe('provision-workflow-dispatch', () => {
  it('buildProvisionWorkflowDispatchInputs sets known keys and empty optionals', () => {
    const i = buildProvisionWorkflowDispatchInputs({
      appName: 'my-app',
      displayName: 'My App',
      appUrl: 'https://my-app.example',
      githubRepo: 'org/my-app',
      provisionId: 'prov_1',
      nuxtPort: '3010',
      appDescription: 'A test app',
    })
    expect(i['app-name']).toBe('my-app')
    expect(i['display-name']).toBe('My App')
    expect(i['app-url']).toBe('https://my-app.example')
    expect(i['github-repo']).toBe('org/my-app')
    expect(i['provision-id']).toBe('prov_1')
    expect(i['nuxt-port']).toBe('3010')
    expect(i['app-description']).toBe('A test app')
    expect(i['d1-database-id']).toBe('')
    for (const k of PROVISION_WORKFLOW_INPUT_KEYS) {
      expect(i).toHaveProperty(k)
    }
  })

  it('buildProvisionWorkflowDispatchInputs applies overrides', () => {
    const i = buildProvisionWorkflowDispatchInputs({
      appName: 'x',
      displayName: 'X',
      appUrl: 'https://x',
      githubRepo: 'o/x',
      provisionId: 'p',
      nuxtPort: '3000',
      overrides: {
        'd1-database-id': 'uuid-1',
        'indexnow-key': 'abc123',
      },
    })
    expect(i['d1-database-id']).toBe('uuid-1')
    expect(i['indexnow-key']).toBe('abc123')
  })

  it('parseStoredDispatchInputs filters to known string keys', () => {
    expect(parseStoredDispatchInputs(null)).toBeNull()
    expect(parseStoredDispatchInputs('')).toBeNull()
    expect(parseStoredDispatchInputs('not json')).toBeNull()
    expect(parseStoredDispatchInputs('[]')).toBeNull()
    const parsed = parseStoredDispatchInputs(
      JSON.stringify({
        'd1-database-id': 'abc',
        'provision-id': 'stored-id',
        extra: 1,
        'bad': null,
      }),
    )
    expect(parsed).toEqual({ 'd1-database-id': 'abc', 'provision-id': 'stored-id' })
  })

  it('mergeDispatchInputs ignores provision-id and empty patches', () => {
    const base = buildProvisionWorkflowDispatchInputs({
      appName: 'a',
      displayName: 'A',
      appUrl: 'https://a',
      githubRepo: 'o/a',
      provisionId: 'p1',
      nuxtPort: '3001',
    })
    const merged = mergeDispatchInputs(base, {
      'provision-id': 'p2',
      'd1-database-id': 'db-9',
      'ga-measurement-id': '',
    })
    expect(merged['provision-id']).toBe('p1')
    expect(merged['d1-database-id']).toBe('db-9')
  })

  it('dispatchInputsForRetry merges stored dispatch JSON and preserves gaPropertyId', () => {
    const job = {
      id: 'prov_retry',
      appName: 'app',
      displayName: 'App',
      appUrl: 'https://app',
      githubRepo: 'o/app',
      nuxtPort: 3020,
      gaPropertyId: '12345',
      dispatchInputsJson: JSON.stringify({
        'd1-database-id': 'd1-xyz',
        'ga-measurement-id': 'G-TEST',
      }),
    }
    const inputs = dispatchInputsForRetry(job)
    expect(inputs['provision-id']).toBe('prov_retry')
    expect(inputs['d1-database-id']).toBe('d1-xyz')
    expect(inputs['ga-measurement-id']).toBe('G-TEST')
    expect(inputs['ga-property-id']).toBe('12345')
    expect(inputs['nuxt-port']).toBe('3020')
  })
})
