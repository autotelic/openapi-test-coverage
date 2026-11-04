import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { createCoverageAfterAll } from '../src/adapters/mocha.js'
import { Recorder } from '../src/recorder.js'
import type { OpenAPISpec } from '../src/types.js'

const spec: OpenAPISpec = {
  openapi: '3.0.3',
  paths: {
    '/items': {
      get: {
        responses: {
          200: { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } },
        },
      },
    },
  },
}

function recorderWithStrippedField(): Recorder {
  const recorder = new Recorder()
  recorder.record({
    method: 'GET',
    pathname: '/items',
    responseStatusCode: 200,
    responseContentType: 'application/json',
    responseBody: { id: 1 },
    responseRawBody: { id: 1, secret: 'x' },
  })
  return recorder
}

const run = (conformance: Parameters<typeof createCoverageAfterAll>[0]['conformance']) => {
  const recorder = recorderWithStrippedField()
  return createCoverageAfterAll({ getRecorder: () => recorder, getSpec: () => spec, console: false, conformance })
}

describe('createCoverageAfterAll conformance', () => {
  it('reports without failing by default', () => {
    expect(() => run({ console: false })()).not.toThrow()
  })

  it('fails on a new violation when asked to', () => {
    expect(() => run({ console: false, failOnNew: true })()).toThrow(/GET \/items 200 dropped secret/)
  })

  it('does not fail on a baselined violation', () => {
    expect(() => run({ console: false, failOnNew: true, baseline: ['GET /items 200 dropped secret'] })()).not.toThrow()
  })

  it('writes a report whose baselineKeys accept the current state', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'conformance-')), 'report.json')
    run({ console: false, jsonReportPath: file })()
    const report = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(report.baselineKeys).toEqual(['GET /items 200 dropped secret'])
    expect(report.checked).toBe(1)
  })
})
