import { describe, it, expect } from 'vitest'
import { walkSpec } from '../src/spec-walker.js'
import type { OpenAPISpec } from '../src/types.js'

const spec: OpenAPISpec = {
  openapi: '3.0.3',
  paths: {
    '/items': {
      get: {
        parameters: [
          { name: 'limit', in: 'query' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: { content: { 'application/json': {} } },
          403: { content: { 'application/json': {} } },
        },
      },
      post: {
        requestBody: { content: { 'application/json': {} } },
        responses: { 201: { content: { 'application/json': {} } } },
      },
    },
    '/items/{id}': {
      get: {
        parameters: [{ name: 'id', in: 'path' }],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/excluded': {
      get: { responses: { 200: {} } },
    },
  },
}

describe('walkSpec', () => {
  it('extracts all paths', () => {
    const walked = walkSpec(spec)
    expect(walked.paths).toEqual(['/items', '/items/{id}', '/excluded'])
  })

  it('excludes paths', () => {
    const walked = walkSpec(spec, ['/excluded'])
    expect(walked.paths).not.toContain('/excluded')
  })

  it('extracts operations', () => {
    const walked = walkSpec(spec, ['/excluded'])
    expect(walked.operations).toEqual([
      { path: '/items', method: 'GET' },
      { path: '/items', method: 'POST' },
      { path: '/items/{id}', method: 'GET' },
    ])
  })

  it('extracts parameters including body content-types', () => {
    const walked = walkSpec(spec, ['/excluded'])
    const paramKeys = walked.parameters.map(p => `${p.method} ${p.path} ${p.in}:${p.paramName}`)
    expect(paramKeys).toContain('GET /items query:limit')
    expect(paramKeys).toContain('GET /items query:sort')
    expect(paramKeys).toContain('GET /items/{id} path:id')
    expect(paramKeys).toContain('POST /items body:application/json')
  })

  it('extracts parameter values for enums', () => {
    const walked = walkSpec(spec, ['/excluded'])
    const values = walked.parameterValues.map(v => `${v.paramName}=${v.value}`)
    expect(values).toContain('sort=asc')
    expect(values).toContain('sort=desc')
  })

  it('extracts status code classes', () => {
    const walked = walkSpec(spec, ['/excluded'])
    const classes = walked.statusCodeClasses.map(c => `${c.method} ${c.path} ${c.class}`)
    expect(classes).toContain('GET /items 2xx')
    expect(classes).toContain('GET /items 4xx/5xx')
  })

  it('extracts response body properties', () => {
    const walked = walkSpec(spec, ['/excluded'])
    const props = walked.responseBodyProperties.map(r => r.propertyPath)
    expect(props).toContain('id')
    expect(props).toContain('name')
  })
})
