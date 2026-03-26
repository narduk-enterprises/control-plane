import type { FleetDatabaseColumnInfo } from '~/types/fleet'

export function isBooleanColumn(column: FleetDatabaseColumnInfo): boolean {
  return /\bbool(?:ean)?\b/i.test(column.type)
}

export function isNumericColumn(column: FleetDatabaseColumnInfo): boolean {
  return /\b(?:int(?:eger)?|smallint|bigint|real|double(?:\s+precision)?|float|numeric|decimal)\b/i.test(
    column.type,
  )
}

export function parseBooleanDraft(columnName: string, rawValue: string): boolean {
  const normalized = rawValue.trim().toLowerCase()
  if (['true', 't', '1', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', 'f', '0', 'no', 'n', 'off'].includes(normalized)) return false

  throw new Error(`Column "${columnName}" expects a boolean value (true/false).`)
}

export function coerceColumnDraftValue(column: FleetDatabaseColumnInfo, rawValue: string) {
  if (isBooleanColumn(column)) {
    return parseBooleanDraft(column.name, rawValue)
  }

  if (isNumericColumn(column)) {
    const parsed = Number(rawValue.trim())
    if (!Number.isFinite(parsed)) {
      throw new Error(`Column "${column.name}" expects a numeric value.`)
    }
    return parsed
  }

  return rawValue
}
