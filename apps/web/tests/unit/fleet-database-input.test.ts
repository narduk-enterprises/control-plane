import { describe, expect, it } from 'vitest'
import { coerceColumnDraftValue } from '../../app/utils/fleet-database-input'

describe('coerceColumnDraftValue', () => {
  it('coerces Postgres booleans from text input', () => {
    const column = {
      cid: 0,
      name: 'is_admin',
      type: 'boolean',
      notnull: 0,
      dflt_value: null,
      pk: 0,
    }

    expect(coerceColumnDraftValue(column, 'true')).toBe(true)
    expect(coerceColumnDraftValue(column, '0')).toBe(false)
  })

  it('coerces numeric columns from text input', () => {
    const column = {
      cid: 0,
      name: 'score',
      type: 'integer',
      notnull: 0,
      dflt_value: null,
      pk: 0,
    }

    expect(coerceColumnDraftValue(column, '42')).toBe(42)
  })

  it('rejects invalid boolean input', () => {
    const column = {
      cid: 0,
      name: 'is_admin',
      type: 'boolean',
      notnull: 0,
      dflt_value: null,
      pk: 0,
    }

    expect(() => coerceColumnDraftValue(column, 'maybe')).toThrow(
      'expects a boolean value',
    )
  })
})
