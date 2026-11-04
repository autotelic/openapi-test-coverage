import type { RecordedCall, MatchResult } from './types.js'

export function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) return pathname || '/'
  const p = pathname || '/'
  if (p === basePath) return '/'
  if (basePath.length > 0 && p.startsWith(basePath + '/')) {
    return '/' + p.slice(basePath.length + 1)
  }
  if (p.startsWith(basePath)) {
    return p.slice(basePath.length) || '/'
  }
  return p
}

export function pathTemplateToRegex(pathTemplate: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = []
  const pattern = pathTemplate.replace(/\{([^}]+)\}/g, (_, name: string) => {
    paramNames.push(name)
    return '([^/]+)'
  })
  const regex = new RegExp('^' + pattern + '$')
  return { regex, paramNames }
}

/**
 * Most specific template first: deeper paths, then fewer parameters, then longer text.
 * Length alone is not enough: `/projects/{projectId}` is longer than `/projects/table` and
 * would claim `/projects/table` as a project id.
 */
export function compareTemplateSpecificity(a: string, b: string): number {
  const segmentsA = a.split('/')
  const segmentsB = b.split('/')
  if (segmentsA.length !== segmentsB.length) return segmentsB.length - segmentsA.length
  const parametersA = segmentsA.filter(segment => segment.includes('{')).length
  const parametersB = segmentsB.filter(segment => segment.includes('{')).length
  if (parametersA !== parametersB) return parametersA - parametersB
  return b.length - a.length
}

/**
 * Match a recorded request to a spec path template. Returns the matched
 * path key, normalised method, and extracted path params; or null if no
 * spec path matches.
 */
export function matchRequestToSpec(
  recordedCall: Pick<RecordedCall, 'method' | 'pathname'>,
  specPathKeys: string[],
  basePath: string,
): MatchResult | null {
  const method = (recordedCall.method || '').toUpperCase()
  const rawPath = (recordedCall.pathname || '').replace(/\/+$/, '') || '/'
  const pathname = stripBasePath(rawPath, basePath)

  const sortedPaths = [...specPathKeys].sort(compareTemplateSpecificity)
  for (const pathKey of sortedPaths) {
    const { regex, paramNames } = pathTemplateToRegex(pathKey)
    const match = pathname.match(regex)
    if (match) {
      const pathParams: Record<string, string> = {}
      paramNames.forEach((name, i) => {
        pathParams[name] = match[i + 1]
      })
      return { pathKey, method, pathParams }
    }
  }
  return null
}
