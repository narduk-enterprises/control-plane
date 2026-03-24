export interface GeneratedFiles {
  appConfig: string
  mainCss: string
  indexVue: string
  appVue: string
}

export interface GeneratedFilesNormalizationResult {
  files: GeneratedFiles
  notes: string[]
}

const TEMPLATE_LITERAL_SUFFIX_FALLBACK_PATTERN = /`\$\{([\s\S]*?)\}\s*(?:\|\||\?\?)\s*(?:''|"")`/g

const STRING_LITERAL_FALLBACK_PATTERN =
  /((?:'(?:\\.|[^'\\])*')|(?:"(?:\\.|[^"\\])*")|(?:`(?:\\.|[^`])*`))\s*(?:\|\||\?\?)\s*(?:''|"")/g

function stripAlwaysTruthyStringFallbacks(code: string): {
  code: string
  replacements: number
} {
  let replacements = 0

  const withoutTemplateSuffixFallbacks = code.replace(
    TEMPLATE_LITERAL_SUFFIX_FALLBACK_PATTERN,
    (_match, expression: string) => {
      replacements += 1
      return `\`\${${expression}}\``
    },
  )

  const normalized = withoutTemplateSuffixFallbacks.replace(
    STRING_LITERAL_FALLBACK_PATTERN,
    (match, literal: string) => {
      if (match === literal) {
        return match
      }

      replacements += 1
      return literal
    },
  )

  return {
    code: normalized,
    replacements,
  }
}

export function normalizeGeneratedFiles(files: GeneratedFiles): GeneratedFilesNormalizationResult {
  const normalizedFiles: GeneratedFiles = {
    ...files,
  }
  const notes: string[] = []

  for (const key of ['appConfig', 'indexVue', 'appVue'] as const) {
    const result = stripAlwaysTruthyStringFallbacks(files[key])
    normalizedFiles[key] = result.code

    if (result.replacements > 0) {
      notes.push(
        `${key}: stripped ${result.replacements} always-truthy string fallback${result.replacements === 1 ? '' : 's'}`,
      )
    }
  }

  return {
    files: normalizedFiles,
    notes,
  }
}
