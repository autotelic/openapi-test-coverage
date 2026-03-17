import { describe, it, expect } from 'vitest'
import { computeCoverage, computeTcl } from '../src/coverage.js'
import type { OpenAPISpec, RecordedCall, TclInputs } from '../src/types.js'

const minimalSpec: OpenAPISpec = {
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
      put: {
        parameters: [{ name: 'id', in: 'path' }],
        requestBody: { content: { 'application/json': {} } },
        responses: {
          200: { content: { 'application/json': {} } },
          400: { content: { 'application/json': {} } },
        },
      },
    },
  },
  servers: [{ url: 'http://localhost/v1' }],
}

const fullCoverageCalls: RecordedCall[] = [
  { method: 'GET', pathname: '/v1/items', queryParams: { limit: '10', sort: 'asc' }, responseStatusCode: 200, responseContentType: 'application/json', statusCodeAsserted: true },
  { method: 'GET', pathname: '/v1/items', queryParams: { sort: 'desc' }, responseStatusCode: 403, responseContentType: 'application/json', statusCodeAsserted: true },
  {
    method: 'GET',
    pathname: '/v1/items/abc',
    pathParams: { id: 'abc' },
    responseStatusCode: 200,
    responseContentType: 'application/json',
    responseBody: { id: 'abc', name: 'Item ABC' },
    statusCodeAsserted: true,
  },
  { method: 'PUT', pathname: '/v1/items/abc', pathParams: { id: 'abc' }, requestContentType: 'application/json', responseStatusCode: 200, responseContentType: 'application/json', statusCodeAsserted: true },
  { method: 'PUT', pathname: '/v1/items/xyz', pathParams: { id: 'xyz' }, requestContentType: 'application/json', responseStatusCode: 400, responseContentType: 'application/json', statusCodeAsserted: true },
]

describe('computeCoverage', () => {
  it('reaches TCL 6 with full coverage on minimal spec', () => {
    const coverage = computeCoverage(fullCoverageCalls, minimalSpec)
    expect(coverage.tcl).toBe(6)
    expect(coverage.path.covered).toBe(coverage.path.total)
    expect(coverage.operation.covered).toBe(coverage.operation.total)
    expect(coverage.statusCode.covered).toBe(coverage.statusCode.total)
    expect(coverage.parameter.covered).toBe(coverage.parameter.total)
    expect(coverage.parameterValue.covered).toBe(coverage.parameterValue.total)
    expect(coverage.inputContentType.covered).toBe(coverage.inputContentType.total)
    expect(coverage.outputContentType.covered).toBe(coverage.outputContentType.total)
    expect(coverage.statusCodeClass.covered).toBe(coverage.statusCodeClass.total)
    expect(coverage.responseBodyProperties.covered).toBe(coverage.responseBodyProperties.total)
    expect(coverage.responseAsserted.covered).toBe(coverage.responseAsserted.total)
  })

  it('reports 0 coverage with no recorded calls', () => {
    const coverage = computeCoverage([], minimalSpec)
    expect(coverage.tcl).toBe(0)
    expect(coverage.path.covered).toBe(0)
    expect(coverage.operation.covered).toBe(0)
    expect(coverage.statusCode.covered).toBe(0)
  })

  it('correctly computes TCL 1 when only paths are covered', () => {
    const calls: RecordedCall[] = [
      { method: 'GET', pathname: '/v1/items', responseStatusCode: 200 },
      { method: 'GET', pathname: '/v1/items/1', responseStatusCode: 200 },
    ]
    const coverage = computeCoverage(calls, minimalSpec)
    expect(coverage.path.covered).toBe(coverage.path.total)
    expect(coverage.tcl).toBeGreaterThanOrEqual(1)
  })

  it('respects excludedPaths', () => {
    const coverage = computeCoverage(fullCoverageCalls, minimalSpec, {
      excludedPaths: ['/items/{id}'],
    })
    expect(coverage.path.total).toBe(1)
    expect(coverage.operation.total).toBeLessThan(3)
  })

  it('respects excludedStatusCodes', () => {
    const partial: RecordedCall[] = [
      { method: 'GET', pathname: '/v1/items', queryParams: { limit: '10', sort: 'asc' }, responseStatusCode: 200, responseContentType: 'application/json', statusCodeAsserted: true },
      { method: 'GET', pathname: '/v1/items/abc', pathParams: { id: 'abc' }, responseStatusCode: 200, responseContentType: 'application/json', responseBody: { id: 'abc', name: 'Item ABC' }, statusCodeAsserted: true },
      { method: 'PUT', pathname: '/v1/items/abc', pathParams: { id: 'abc' }, requestContentType: 'application/json', responseStatusCode: 200, responseContentType: 'application/json', statusCodeAsserted: true },
    ]
    const coverage = computeCoverage(partial, minimalSpec, {
      excludedStatusCodes: [
        '/items\tGET\t403',
        '/items/{id}\tPUT\t400',
      ],
    })
    expect(coverage.statusCode.covered).toBe(coverage.statusCode.total)
  })

  it('tracks response body properties', () => {
    const coverage = computeCoverage(fullCoverageCalls, minimalSpec)
    expect(coverage.responseBodyProperties.total).toBe(2) // id, name
    expect(coverage.responseBodyProperties.covered).toBe(2)
    expect(coverage.responseBodyProperties.missing).toHaveLength(0)
  })
})

describe('computeTcl', () => {
  const base: TclInputs = {
    pathCovered: 10, pathTotal: 10,
    operationCovered: 20, operationTotal: 20,
    inputContentTypeCovered: 5, inputContentTypeTotal: 5,
    outputContentTypeCovered: 10, outputContentTypeTotal: 10,
    parameterCovered: 15, parameterTotal: 15,
    statusCodeClassCovered: 10, statusCodeClassTotal: 10,
    statusCodeCovered: 30, statusCodeTotal: 30,
    parameterValueCovered: 4, parameterValueTotal: 4,
    responseBodyPropertiesCovered: 50, responseBodyPropertiesTotal: 50,
  }

  it('returns 6 when everything is covered', () => {
    expect(computeTcl(base)).toBe(6)
  })

  it('returns 0 when no paths are covered', () => {
    expect(computeTcl({ ...base, pathCovered: 0 })).toBe(0)
  })

  it('returns 1 when operations are incomplete', () => {
    expect(computeTcl({ ...base, operationCovered: 19 })).toBe(1)
  })

  it('returns 2 when content-types are incomplete', () => {
    expect(computeTcl({ ...base, inputContentTypeCovered: 4 })).toBe(2)
  })

  it('returns 3 when parameters are incomplete', () => {
    expect(computeTcl({ ...base, parameterCovered: 14 })).toBe(3)
  })

  it('returns 4 when status codes are incomplete', () => {
    expect(computeTcl({ ...base, statusCodeCovered: 29 })).toBe(4)
  })

  it('returns 5 when response body properties are incomplete', () => {
    expect(computeTcl({ ...base, responseBodyPropertiesCovered: 49 })).toBe(5)
  })
})
