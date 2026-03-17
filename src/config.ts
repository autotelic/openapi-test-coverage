import type { OpenAPISpec } from './types.js'

export function getBasePath(spec: OpenAPISpec): string {
  if (!spec.servers || spec.servers.length === 0) return ''
  const url = spec.servers[0].url
  try {
    const parsed = new URL(url)
    return parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname
  } catch {
    return ''
  }
}

export interface ResolvedConfig {
  basePath: string
  excludedPaths: string[]
  excludedResponseBodyProperties: string[]
  excludedStatusCodes: string[]
}

export function getConfig(
  spec: OpenAPISpec,
  excludedPaths: string[] = [],
  excludedResponseBodyProperties: string[] = [],
  excludedStatusCodes: string[] = [],
): ResolvedConfig {
  return {
    basePath: getBasePath(spec),
    excludedPaths: Array.isArray(excludedPaths) ? excludedPaths : [],
    excludedResponseBodyProperties: Array.isArray(excludedResponseBodyProperties) ? excludedResponseBodyProperties : [],
    excludedStatusCodes: Array.isArray(excludedStatusCodes) ? excludedStatusCodes : [],
  }
}
