function matchDollarTag(sql: string, index: number): string | null {
  const slice = sql.slice(index)
  const match = slice.match(/^\$(?:[a-z_]\w*)?\$/i)
  return match?.[0] ?? null
}

/**
 * Split SQL text into statements while preserving quoted strings, comments,
 * and Postgres dollar-quoted blocks.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let index = 0
  let mode: 'code' | 'single' | 'double' | 'line-comment' | 'block-comment' | 'dollar' = 'code'
  let blockDepth = 0
  let dollarTag = ''

  while (index < sql.length) {
    if (mode === 'code') {
      if (sql.startsWith('--', index)) {
        current += '--'
        index += 2
        mode = 'line-comment'
        continue
      }

      if (sql.startsWith('/*', index)) {
        current += '/*'
        index += 2
        mode = 'block-comment'
        blockDepth = 1
        continue
      }

      const tag = matchDollarTag(sql, index)
      if (tag) {
        current += tag
        index += tag.length
        mode = 'dollar'
        dollarTag = tag
        continue
      }

      const char = sql[index]
      if (char === "'") {
        current += char
        index += 1
        mode = 'single'
        continue
      }

      if (char === '"') {
        current += char
        index += 1
        mode = 'double'
        continue
      }

      if (char === ';') {
        const trimmed = current.trim()
        if (trimmed) {
          statements.push(trimmed)
        }
        current = ''
        index += 1
        continue
      }

      current += char
      index += 1
      continue
    }

    if (mode === 'single') {
      const char = sql[index]
      current += char
      index += 1

      if (char === "'" && sql[index] === "'") {
        current += sql[index]
        index += 1
        continue
      }

      if (char === "'") {
        mode = 'code'
      }
      continue
    }

    if (mode === 'double') {
      const char = sql[index]
      current += char
      index += 1

      if (char === '"' && sql[index] === '"') {
        current += sql[index]
        index += 1
        continue
      }

      if (char === '"') {
        mode = 'code'
      }
      continue
    }

    if (mode === 'line-comment') {
      const char = sql[index]
      current += char
      index += 1

      if (char === '\n') {
        mode = 'code'
      }
      continue
    }

    if (mode === 'block-comment') {
      if (sql.startsWith('/*', index)) {
        current += '/*'
        index += 2
        blockDepth += 1
        continue
      }

      if (sql.startsWith('*/', index)) {
        current += '*/'
        index += 2
        blockDepth -= 1
        if (blockDepth <= 0) {
          mode = 'code'
        }
        continue
      }

      current += sql[index]
      index += 1
      continue
    }

    if (sql.startsWith(dollarTag, index)) {
      current += dollarTag
      index += dollarTag.length
      dollarTag = ''
      mode = 'code'
      continue
    }

    current += sql[index]
    index += 1
  }

  const trimmed = current.trim()
  if (trimmed) {
    statements.push(trimmed)
  }

  return statements
}
