import type { OpenAPISpec, SchemaObject } from './types.js'

export function resolveSchemaRef(spec: OpenAPISpec, schema: SchemaObject | null | undefined): SchemaObject | null {
  if (!schema || typeof schema !== 'object') return null
  if (schema.$ref) {
    const ref = schema.$ref
    if (typeof ref !== 'string') return null
    const parts = ref.replace(/^#\//, '').split('/')
    let cur: unknown = spec
    for (const p of parts) {
      cur = (cur as Record<string, unknown>)?.[p]
    }
    return (cur as SchemaObject) || null
  }
  return schema
}

/**
 * Collect all property paths from an OpenAPI schema (for response body coverage).
 * Paths use dot notation; arrays use "[]" suffix, e.g. "items[].id".
 */
export function collectSchemaPaths(
  spec: OpenAPISpec,
  schema: SchemaObject | null | undefined,
  prefix = '',
  seen: Set<string> = new Set(),
): string[] {
  const resolved = resolveSchemaRef(spec, schema)
  if (!resolved) return []

  if (resolved.$ref) {
    const refId = resolved.$ref
    if (seen.has(refId)) return []
    seen.add(refId)
    const out = collectSchemaPaths(spec, resolved, prefix, seen)
    seen.delete(refId)
    return out
  }

  const paths: string[] = []
  if (resolved.type === 'object' && resolved.properties && typeof resolved.properties === 'object') {
    for (const [key, subSchema] of Object.entries(resolved.properties)) {
      const fullPath = prefix ? `${prefix}.${key}` : key
      paths.push(fullPath)
      paths.push(...collectSchemaPaths(spec, subSchema, fullPath, seen))
    }
    return paths
  }
  if (resolved.type === 'array' && resolved.items) {
    const arrayPrefix = prefix ? `${prefix}[]` : '[]'
    paths.push(arrayPrefix)
    const childPrefix = arrayPrefix + '.'
    paths.push(...collectSchemaPaths(spec, resolved.items, childPrefix, seen))
    return paths
  }
  return paths
}

/**
 * Collect property paths from a JSON value (actual response body).
 */
export function collectPathsFromValue(value: unknown, prefix = ''): string[] {
  if (value === null || value === undefined) return []
  const paths: string[] = []
  if (Array.isArray(value)) {
    const arrayPrefix = prefix ? `${prefix}[]` : '[]'
    paths.push(arrayPrefix)
    const childPrefix = arrayPrefix + '.'
    for (let i = 0; i < value.length; i++) {
      paths.push(...collectPathsFromValue(value[i], childPrefix))
    }
    return paths
  }
  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const fullPath = prefix ? `${prefix}.${key}` : key
      paths.push(fullPath)
      paths.push(...collectPathsFromValue(val, fullPath))
    }
    return paths
  }
  return []
}
