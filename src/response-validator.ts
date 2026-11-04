import AjvDraft07, { type ErrorObject, type ValidateFunction } from 'ajv'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { OpenAPISpec } from './types.js'

const SPEC_ID = 'openapi-spec.json'

// OpenAPI's own formats. They describe storage, not validity, except the integer widths.
const OPENAPI_FORMATS: Record<string, { type: 'number' | 'string'; validate: (v: never) => boolean }> = {
  int32: { type: 'number', validate: (v: number) => Number.isInteger(v) && v >= -(2 ** 31) && v < 2 ** 31 },
  int64: { type: 'number', validate: (v: number) => Number.isInteger(v) },
  float: { type: 'number', validate: () => true },
  double: { type: 'number', validate: () => true },
  byte: { type: 'string', validate: () => true },
  binary: { type: 'string', validate: () => true },
  password: { type: 'string', validate: () => true },
}

export interface ResponseValidator {
  /**
   * Validate a body against the schema at a JSON pointer into the spec.
   * Returns the errors, an empty array when valid, or a string when the schema cannot compile.
   */
  validate(pointer: string, body: unknown): ErrorObject[] | string
}

/**
 * OpenAPI 3.0 schemas are not JSON Schema: `nullable` is a sibling flag, and
 * `exclusiveMinimum`/`exclusiveMaximum` are booleans beside `minimum`/`maximum`. Rewrite both
 * into draft-07 so Ajv's meaning is the spec's meaning. Ajv's own `nullable` support refuses a
 * schema without `type`, which `$ref` + `nullable` routinely is.
 */
export function toJsonSchemaDialect(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value
  // A spec dereferenced into shared (or cyclic) objects must not recurse forever.
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const items: unknown[] = []
    seen.set(value, items)
    for (const item of value) items.push(toJsonSchemaDialect(item, seen))
    return items
  }

  const out: Record<string, unknown> = {}
  seen.set(value, out)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = toJsonSchemaDialect(child, seen)
  }

  for (const [flag, bound] of [['exclusiveMinimum', 'minimum'], ['exclusiveMaximum', 'maximum']] as const) {
    if (typeof out[flag] === 'boolean') {
      if (out[flag] === true && typeof out[bound] === 'number') {
        out[flag] = out[bound]
        delete out[bound]
      } else {
        delete out[flag]
      }
    }
  }

  if (out.nullable === true) {
    delete out.nullable
    if (typeof out.type === 'string') {
      out.type = [out.type, 'null']
      if (Array.isArray(out.enum) && !out.enum.includes(null)) out.enum = [...out.enum, null]
    } else if (!Array.isArray(out.type)) {
      return { anyOf: [out, { type: 'null' }] }
    }
  } else if (out.nullable === false) {
    delete out.nullable
  }

  return out
}

/** Escape a spec key (a path, a media type) as one JSON-pointer segment inside a URI fragment. */
export function pointerSegment(segment: string): string {
  return encodeURIComponent(segment.replace(/~/g, '~0').replace(/\//g, '~1'))
}

export function createResponseValidator(spec: OpenAPISpec): ResponseValidator {
  const is31 = typeof spec.openapi === 'string' && spec.openapi.startsWith('3.1')
  const options = {
    allErrors: true,
    strict: false,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    validateSchema: false,
    logger: false,
  } as const
  const ajv = is31 ? new Ajv2020(options) : new AjvDraft07(options)
  addFormats(ajv)
  for (const [name, format] of Object.entries(OPENAPI_FORMATS)) {
    ajv.addFormat(name, format as { type: 'number'; validate: (v: number) => boolean })
  }

  // 3.1 dropped `nullable`, but specs written for 3.0 habits still carry it and Fastify's
  // serializer still honours it, so it is rewritten whatever the version.
  const document = toJsonSchemaDialect(spec)
  ajv.addSchema(document as object, SPEC_ID)

  const compiled = new Map<string, ValidateFunction | string>()

  return {
    validate(pointer, body) {
      let entry = compiled.get(pointer)
      if (entry === undefined) {
        try {
          entry = ajv.compile({ $ref: `${SPEC_ID}#${pointer}` })
        } catch (err) {
          entry = err instanceof Error ? err.message : String(err)
        }
        compiled.set(pointer, entry)
      }
      if (typeof entry === 'string') return entry
      return entry(body) ? [] : [...(entry.errors ?? [])]
    },
  }
}
