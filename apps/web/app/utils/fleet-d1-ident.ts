/** Match server `fleet-d1-studio` identifier rules for safe quoted SQL fragments. */
const SAFE = /^[_a-z]\w*$/i

export function quoteD1Ident(name: string): string {
  if (!SAFE.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`)
  }
  return `"${name.replaceAll('"', '""')}"`
}
