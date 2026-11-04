import type { ErrorObject } from 'ajv'
import type {
  ConformanceComparison,
  ConformanceKind,
  ConformanceResult,
  ConformanceViolation,
  CoverageConfig,
  OpenAPISpec,
  RecordedCall,
} from './types.js'
import { getConfig } from './config.js'
import { matchRequestToSpec } from './matcher.js'
import { collectPathsFromValue } from './schema-utils.js'
import { walkSpec } from './spec-walker.js'
import { createResponseValidator, pointerSegment } from './response-validator.js'

type Responses = Record<string, { content?: Record<string, { schema?: unknown }> } | undefined>

/** The documented response for a status: exact code, then its range (`4XX`), then `default`. */
function documentedStatus(responses: Responses, statusCode: number): string | null {
  const exact = String(statusCode)
  if (responses[exact]) return exact
  const range = `${exact[0]}XX`
  for (const key of Object.keys(responses)) {
    if (key.toUpperCase() === range) return key
  }
  return responses.default ? 'default' : null
}

/** The documented media type a response's content type answers to. */
function documentedMediaType(content: Record<string, unknown>, contentType: string): string | null {
  if (content[contentType]) return contentType
  if (contentType.includes('json')) {
    const json = Object.keys(content).find(key => key.toLowerCase().includes('json'))
    if (json) return json
  }
  return null
}

/** `/items/0/price` → `items[].price`, the coverage report's notation. */
function locationOf(instancePath: string): string {
  let out = ''
  for (const raw of instancePath.split('/').slice(1)) {
    const segment = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (/^\d+$/.test(segment)) out += '[]'
    else out += out === '' ? segment : `.${segment}`
  }
  return out
}

function joinLocation(parent: string, child: string): string {
  return parent === '' ? child : `${parent}.${child}`
}

function schemaViolation(error: ErrorObject): { location: string; keyword: string; message: string } {
  let location = locationOf(error.instancePath)
  if (error.keyword === 'required') {
    location = joinLocation(location, String((error.params as { missingProperty?: string }).missingProperty))
  }
  return { location, keyword: error.keyword, message: `${location || '(body)'} ${error.message ?? 'is invalid'}` }
}

// `collectPathsFromValue` writes array children as `items[]..id`. Coverage keys (and consumers'
// coverage exclusions) depend on that, so it stays; conformance keys use the documented `items[].id`.
const propertyPaths = (value: unknown) => collectPathsFromValue(value).map(path => path.replace(/\[\]\.\./g, '[].'))

function droppedPaths(intended: unknown, sent: unknown): string[] {
  const kept = new Set(propertyPaths(sent))
  const dropped = new Set<string>()
  for (const path of propertyPaths(intended)) {
    if (kept.has(path)) continue
    // Report the outermost missing field, not every field beneath it.
    if ([...dropped].some(parent => path.startsWith(`${parent}.`) || path.startsWith(`${parent}[]`))) continue
    dropped.add(path)
  }
  return [...dropped]
}

/**
 * Check recorded responses against the spec: does each body match its schema, did any field the
 * handler returned go missing on the way out, and is each status code documented?
 *
 * The schema check prefers `responseRawBody` (what the handler returned), because a
 * schema-driven serializer coerces and strips until the sent body looks valid. Calls that match
 * no documented operation are ignored; coverage reports those.
 */
export function checkConformance(
  recordedCalls: RecordedCall[],
  spec: OpenAPISpec,
  config: CoverageConfig = {},
): ConformanceResult {
  const { basePath, excludedPaths } = getConfig(spec, config.excludedPaths)
  const specPaths = walkSpec(spec, excludedPaths).paths
  const validator = createResponseValidator(spec)
  const violations = new Map<string, ConformanceViolation>()
  const skipped = new Map<string, string>()
  let checked = 0

  const report = (
    call: RecordedCall,
    v: { kind: ConformanceKind; method: string; path: string; statusCode: string; location: string; keyword?: string; message: string },
  ) => {
    const detail = v.kind === 'schema' ? `schema:${v.keyword}` : v.kind
    const key = [v.method, v.path, v.statusCode, detail, v.location].filter(part => part !== '').join(' ')
    const existing = violations.get(key)
    if (existing) {
      existing.count += 1
      return
    }
    violations.set(key, { key, ...v, count: 1, example: `${call.method} ${call.pathname}` })
  }

  for (const call of recordedCalls) {
    const matched = matchRequestToSpec(call, specPaths, basePath)
    if (!matched) continue
    const operation = (spec.paths?.[matched.pathKey] as Record<string, { responses?: Responses } | undefined>)?.[
      matched.method.toLowerCase()
    ]
    if (!operation) continue
    checked += 1

    const { pathKey: path, method } = matched
    const responses = operation.responses ?? {}
    const statusCode = documentedStatus(responses, call.responseStatusCode)
    if (statusCode === null) {
      report(call, {
        kind: 'status',
        method,
        path,
        statusCode: String(call.responseStatusCode),
        location: '',
        message: `${call.responseStatusCode} is not documented for ${method} ${path}`,
      })
      continue
    }

    const reported = { method, path, statusCode: String(call.responseStatusCode) }

    const intended = call.responseRawBody !== undefined ? call.responseRawBody : call.responseErrorBody
    if (intended !== undefined && call.responseBody != null) {
      for (const location of droppedPaths(intended, call.responseBody)) {
        report(call, {
          kind: 'dropped',
          ...reported,
          location,
          message: `${location} was returned by the handler but not sent: the response schema does not declare it`,
        })
      }
    }

    const content = responses[statusCode]?.content
    const contentType = (call.responseContentType ?? '').split(';')[0].trim().toLowerCase()
    if (!content || !contentType) continue
    const mediaType = documentedMediaType(content, contentType)
    if (!mediaType || content[mediaType]?.schema === undefined) continue

    const body = call.responseRawBody !== undefined ? call.responseRawBody : call.responseBody
    if (body == null) continue

    const pointer = ['paths', path, method.toLowerCase(), 'responses', statusCode, 'content', mediaType, 'schema']
      .map(pointerSegment)
      .join('/')
    const errors = validator.validate(`/${pointer}`, body)
    if (typeof errors === 'string') {
      skipped.set(`${method} ${path} ${statusCode} ${mediaType}`, errors)
      continue
    }
    for (const error of errors) {
      report(call, { kind: 'schema', ...reported, ...schemaViolation(error) })
    }
  }

  return {
    checked,
    violations: [...violations.values()].sort((a, b) => a.key.localeCompare(b.key)),
    skipped: [...skipped].map(([schema, reason]) => ({ schema, reason })),
  }
}

/** An entry matches a key segment by segment; `*` matches any one segment. */
function entryMatches(entry: string, key: string): boolean {
  const want = entry.trim().split(/\s+/)
  const have = key.split(' ')
  if (want.length !== have.length) return false
  return want.every((segment, i) => segment === '*' || segment === have[i])
}

/**
 * Sort violations into new, baselined, and allowed. The baseline is debt and should shrink, so
 * entries that no longer occur come back as `stale`; the allow-list is intent and never does.
 */
export function compareConformance(
  result: ConformanceResult,
  options: { baseline?: string[]; allowed?: string[] } = {},
): ConformanceComparison {
  const baseline = (options.baseline ?? []).filter(entry => typeof entry === 'string' && entry.trim() !== '')
  const allowedEntries = (options.allowed ?? []).filter(entry => typeof entry === 'string' && entry.trim() !== '')
  const comparison: ConformanceComparison = { new: [], baselined: [], allowed: [], stale: [] }
  const used = new Set<string>()

  for (const violation of result.violations) {
    if (allowedEntries.some(entry => entryMatches(entry, violation.key))) {
      comparison.allowed.push(violation)
      continue
    }
    const entry = baseline.find(candidate => entryMatches(candidate, violation.key))
    if (entry !== undefined) {
      used.add(entry)
      comparison.baselined.push(violation)
      continue
    }
    comparison.new.push(violation)
  }

  comparison.stale = baseline.filter(entry => !used.has(entry))
  return comparison
}
