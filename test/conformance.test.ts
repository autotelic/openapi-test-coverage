import { describe, it, expect } from 'vitest'
import { checkConformance, compareConformance } from '../src/conformance.js'
import { toJsonSchemaDialect } from '../src/response-validator.js'
import type { OpenAPISpec, RecordedCall } from '../src/types.js'

const json = 'application/json; charset=utf-8'

const spec: OpenAPISpec = {
  openapi: '3.0.3',
  servers: [{ url: 'http://localhost/v1' }],
  paths: {
    '/projects/{id}': {
      get: {
        responses: {
          200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
          '4XX': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/projects/{id}/undo': {
      post: {
        responses: {
          409: {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { undoRefusal: { type: 'string' } } },
              },
            },
          },
          default: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/internal': {
      get: { responses: { 200: { content: { 'application/json': { schema: { type: 'object' } } } } } },
    },
  },
  components: {
    schemas: {
      Project: {
        type: 'object',
        required: ['id', 'sites'],
        properties: {
          id: { type: 'integer' },
          status: { type: 'string', enum: ['draft', 'active'] },
          owner: { $ref: '#/components/schemas/Owner', nullable: true },
          sites: { type: 'array', items: { $ref: '#/components/schemas/Site' } },
        },
      },
      Owner: { type: 'object', properties: { name: { type: 'string' } } },
      Site: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          planted: { type: 'number', minimum: 0, exclusiveMinimum: true },
        },
      },
      Error: {
        type: 'object',
        required: ['statusCode', 'message'],
        properties: { statusCode: { type: 'integer' }, message: { type: 'string' } },
      },
    },
  },
}

const project = { id: 7, status: 'active', owner: null, sites: [{ name: 'North', planted: 12 }] }

function call(overrides: Partial<RecordedCall>): RecordedCall {
  return {
    method: 'GET',
    pathname: '/v1/projects/7',
    responseStatusCode: 200,
    responseContentType: json,
    responseBody: project,
    ...overrides,
  }
}

const keys = (calls: RecordedCall[]) => checkConformance(calls, spec).violations.map(v => v.key)

describe('checkConformance', () => {
  it('passes a body that matches its schema, through $refs and a nullable $ref', () => {
    const result = checkConformance([call({ responseRawBody: project })], spec)
    expect(result).toEqual({ checked: 1, violations: [], skipped: [] })
  })

  it('validates what the handler returned, not what the serializer coerced it into', () => {
    const raw = { ...project, id: null }
    const sent = { ...project, id: 0 }
    const result = checkConformance([call({ responseRawBody: raw, responseBody: sent })], spec)
    expect(result.violations.map(v => v.key)).toEqual(['GET /projects/{id} 200 schema:type id'])
    expect(result.violations[0].message).toBe('id must be integer, got null')
  })

  it('says what a numeric string was, so a coerced count is told apart from a null', () => {
    const result = checkConformance([call({ responseRawBody: { ...project, id: '7' } })], spec)
    expect(result.violations[0].message).toBe('id must be integer, got string "7"')
  })

  it('falls back to the sent body when no raw body was recorded', () => {
    expect(keys([call({ responseBody: { ...project, status: 'archived' } })])).toEqual([
      'GET /projects/{id} 200 schema:enum status',
    ])
  })

  it('reports a field the handler returned that never reached the client', () => {
    const raw = { ...project, sites: [{ name: 'North', planted: 12, unknown_tree_planted: 3 }] }
    expect(keys([call({ responseRawBody: raw })])).toEqual([
      'GET /projects/{id} 200 dropped sites[].unknown_tree_planted',
    ])
  })

  it('reports the outermost dropped field, not everything beneath it', () => {
    const raw = { ...project, audit: { by: { name: 'Ed' } } }
    expect(keys([call({ responseRawBody: raw })])).toEqual(['GET /projects/{id} 200 dropped audit'])
  })

  it('reports an error body the response schema emptied', () => {
    const result = checkConformance(
      [
        call({
          method: 'POST',
          pathname: '/v1/projects/7/undo',
          responseStatusCode: 409,
          responseBody: { undoRefusal: 'changed_since' },
          responseErrorBody: { statusCode: 409, error: 'Conflict', message: 'It was edited since' },
        }),
      ],
      spec,
    )
    expect(result.violations.map(v => v.key)).toEqual([
      'POST /projects/{id}/undo 409 dropped error',
      'POST /projects/{id}/undo 409 dropped message',
      'POST /projects/{id}/undo 409 dropped statusCode',
    ])
  })

  it('names the missing property of a required failure', () => {
    const { id: _id, ...withoutId } = project
    expect(keys([call({ responseRawBody: withoutId })])).toEqual(['GET /projects/{id} 200 schema:required id'])
  })

  it('reads OpenAPI 3.0 boolean exclusiveMinimum as a bound', () => {
    const raw = { ...project, sites: [{ name: 'North', planted: 0 }] }
    expect(keys([call({ responseRawBody: raw })])).toEqual(['GET /projects/{id} 200 schema:exclusiveMinimum sites[].planted'])
  })

  it('accepts a range status and default, and reports an undocumented status', () => {
    const notFound = call({ responseStatusCode: 404, responseBody: { statusCode: 404, message: 'Not found' } })
    const teapot = call({ method: 'POST', pathname: '/v1/projects/7/undo', responseStatusCode: 418, responseBody: { statusCode: 418, message: 'no' } })
    const serverError = call({ responseStatusCode: 500, responseBody: { statusCode: 500, message: 'boom' } })
    expect(keys([notFound, teapot, serverError])).toEqual(['GET /projects/{id} 500 status'])
  })

  it('counts repeat occurrences under one key and keeps the first example', () => {
    const raw = { ...project, id: 'seven' }
    const result = checkConformance(
      [call({ responseRawBody: raw }), call({ pathname: '/v1/projects/8', responseRawBody: raw })],
      spec,
    )
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({ count: 2, example: 'GET /v1/projects/7', location: 'id' })
  })

  it('checks only JSON bodies: a streamed CSV is not data', () => {
    const csv: OpenAPISpec = {
      openapi: '3.0.3',
      paths: {
        '/export': {
          get: { responses: { 200: { content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } } } } },
        },
      },
    }
    const stream = { _readableState: {}, readable: true }
    const result = checkConformance(
      [call({ pathname: '/export', responseContentType: 'text/csv; charset=utf-8', responseBody: stream })],
      csv,
    )
    expect(result).toEqual({ checked: 1, violations: [], skipped: [] })
  })

  it('ignores calls outside the spec and excluded paths', () => {
    const result = checkConformance(
      [
        call({ pathname: '/v1/nowhere' }),
        call({ method: 'DELETE' }),
        call({ pathname: '/v1/internal', responseStatusCode: 503 }),
      ],
      spec,
      { excludedPaths: ['/internal'] },
    )
    expect(result).toEqual({ checked: 0, violations: [], skipped: [] })
  })

  it('honours a 3.0-style nullable $ref in a 3.1 spec', () => {
    const spec31: OpenAPISpec = { ...spec, openapi: '3.1.0' }
    expect(checkConformance([call({ responseRawBody: project })], spec31).violations).toEqual([])
    expect(
      checkConformance([call({ responseRawBody: { ...project, id: null } })], spec31).violations.map(v => v.key),
    ).toEqual(['GET /projects/{id} 200 schema:type id'])
  })

  it('skips a schema that cannot compile instead of failing the run', () => {
    const broken: OpenAPISpec = {
      openapi: '3.0.3',
      paths: {
        '/x': {
          get: {
            responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Missing' } } } } },
          },
        },
      },
    }
    const result = checkConformance([call({ pathname: '/x', responseBody: {} })], broken)
    expect(result.violations).toEqual([])
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].schema).toBe('GET /x 200 application/json')
  })
})

describe('toJsonSchemaDialect', () => {
  it('turns nullable into a null type, including in an enum', () => {
    expect(toJsonSchemaDialect({ type: 'string', enum: ['a'], nullable: true })).toEqual({
      type: ['string', 'null'],
      enum: ['a', null],
    })
  })

  it('wraps a nullable schema that has no type', () => {
    expect(toJsonSchemaDialect({ $ref: '#/x', nullable: true })).toEqual({ anyOf: [{ $ref: '#/x' }, { type: 'null' }] })
  })

  it('drops a false exclusive bound and moves a true one onto the bound', () => {
    expect(toJsonSchemaDialect({ maximum: 5, exclusiveMaximum: false, minimum: 1, exclusiveMinimum: true })).toEqual({
      maximum: 5,
      exclusiveMinimum: 1,
    })
  })
})

describe('compareConformance', () => {
  const result = checkConformance(
    [
      call({ responseRawBody: { ...project, id: null, password_hash: 'x' } }),
      call({ pathname: '/v1/projects/7', responseStatusCode: 500, responseBody: { statusCode: 500, message: 'boom' } }),
    ],
    spec,
  )

  it('sorts violations into new, baselined, and allowed, and names stale baseline entries', () => {
    const comparison = compareConformance(result, {
      baseline: ['GET /projects/{id} 200 schema:type id', 'GET /projects/{id} 200 schema:type gone'],
      allowed: ['* * * dropped password_hash'],
    })
    expect(comparison.baselined.map(v => v.key)).toEqual(['GET /projects/{id} 200 schema:type id'])
    expect(comparison.allowed.map(v => v.key)).toEqual(['GET /projects/{id} 200 dropped password_hash'])
    expect(comparison.new.map(v => v.key)).toEqual(['GET /projects/{id} 500 status'])
    expect(comparison.stale).toEqual(['GET /projects/{id} 200 schema:type gone'])
  })

  it('treats a malformed baseline as empty', () => {
    const comparison = compareConformance(result, { baseline: [null as unknown as string, ''] })
    expect(comparison.new).toHaveLength(3)
    expect(comparison.stale).toEqual([])
  })
})
