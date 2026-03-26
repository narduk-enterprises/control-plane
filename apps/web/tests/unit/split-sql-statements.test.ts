import { describe, expect, it } from 'vitest'
import { splitSqlStatements } from '../../server/utils/split-sql-statements'

describe('splitSqlStatements', () => {
  it('splits simple semicolon-delimited statements', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('does not split inside quoted strings or comments', () => {
    const sql = `
      SELECT ';' AS literal;
      -- comment with ; inside
      SELECT 'value -- still text';
    `

    expect(splitSqlStatements(sql)).toEqual([
      "SELECT ';' AS literal",
      "-- comment with ; inside\n      SELECT 'value -- still text'",
    ])
  })

  it('does not split inside postgres dollar-quoted blocks', () => {
    const sql = `
      DO $body$
      BEGIN
        RAISE NOTICE 'hello;world';
      END
      $body$;
      SELECT 1;
    `

    expect(splitSqlStatements(sql)).toEqual([
      "DO $body$\n      BEGIN\n        RAISE NOTICE 'hello;world';\n      END\n      $body$",
      'SELECT 1',
    ])
  })
})
