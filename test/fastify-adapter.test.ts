import { describe, it, expect } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { registerCoverageHooks } from '../src/adapters/fastify.js'
import { checkConformance } from '../src/conformance.js'
import type { OpenAPISpec } from '../src/types.js'

// The two ways Fastify's schema-driven serializer has hidden bugs in Shakti: a computed field
// stripped because the response schema did not declare it, and a 409 whose schema named only
// `undoRefusal`, so the client received `{}` plus that one field.

const siteSchema = {
  type: 'object',
  properties: { name: { type: 'string' }, planted: { type: 'integer' } },
}
const tableSchema = { type: 'object', properties: { sites: { type: 'array', items: siteSchema } } }
const refusalSchema = { type: 'object', properties: { undoRefusal: { type: 'string' } } }

const spec: OpenAPISpec = {
  openapi: '3.0.3',
  paths: {
    '/projects/{id}/table': {
      get: { responses: { 200: { content: { 'application/json': { schema: tableSchema } } } } },
    },
    '/audit-log/{id}/undo': {
      post: { responses: { 409: { content: { 'application/json': { schema: refusalSchema } } } } },
    },
  },
}

async function build(options: { customErrorHandler?: boolean; recordRawBody?: boolean } = {}) {
  const app: FastifyInstance = Fastify()
  const recorder = registerCoverageHooks(app, { recordRawBody: options.recordRawBody })
  if (options.customErrorHandler) {
    app.setErrorHandler((err: Error & { statusCode?: number; undoRefusal?: string }, _req, reply) => {
      reply.code(err.statusCode ?? 500).send({
        statusCode: err.statusCode,
        error: 'Conflict',
        message: err.message,
        undoRefusal: err.undoRefusal,
      })
    })
  }
  app.get('/projects/:id/table', { schema: { response: { 200: tableSchema } } }, async () => ({
    sites: [{ name: 'North', planted: null, unknown_tree_planted: 3, plantedAt: new Date(0) }],
  }))
  app.post('/audit-log/:id/undo', { schema: { response: { 409: refusalSchema } } }, async () => {
    throw Object.assign(new Error("This can't be undone because it's been edited since"), {
      statusCode: 409,
      undoRefusal: 'changed_since',
    })
  })
  await app.ready()
  return { app, recorder }
}

describe('Fastify adapter + checkConformance', () => {
  it('sees the fields and nulls the serializer hid', async () => {
    const { app, recorder } = await build()
    const response = await app.inject('/projects/7/table')

    expect(response.json()).toEqual({ sites: [{ name: 'North', planted: 0 }] })
    expect(checkConformance(recorder.getCalls(), spec).violations.map(v => v.key)).toEqual([
      'GET /projects/{id}/table 200 dropped sites[].plantedAt',
      'GET /projects/{id}/table 200 dropped sites[].unknown_tree_planted',
      'GET /projects/{id}/table 200 schema:type sites[].planted',
    ])
  })

  it("sees an error body emptied by the default error handler's serializer", async () => {
    const { app, recorder } = await build()
    const response = await app.inject({ method: 'POST', url: '/audit-log/1/undo' })

    expect(response.json()).toEqual({ undoRefusal: 'changed_since' })
    expect(checkConformance(recorder.getCalls(), spec).violations.map(v => v.key)).toEqual([
      'POST /audit-log/{id}/undo 409 dropped error',
      'POST /audit-log/{id}/undo 409 dropped message',
      'POST /audit-log/{id}/undo 409 dropped statusCode',
    ])
  })

  it('sees an error body emptied after a custom error handler', async () => {
    const { app, recorder } = await build({ customErrorHandler: true })
    await app.inject({ method: 'POST', url: '/audit-log/1/undo' })

    const calls = recorder.getCalls()
    expect(calls[0].responseRawBody).toMatchObject({ statusCode: 409, undoRefusal: 'changed_since' })
    expect(checkConformance(calls, spec).violations.map(v => v.key)).toEqual([
      'POST /audit-log/{id}/undo 409 dropped error',
      'POST /audit-log/{id}/undo 409 dropped message',
      'POST /audit-log/{id}/undo 409 dropped statusCode',
    ])
  })

  it('records only the sent body when raw recording is off', async () => {
    const { app, recorder } = await build({ recordRawBody: false })
    await app.inject('/projects/7/table')

    const [recorded] = recorder.getCalls()
    expect(recorded.responseRawBody).toBeUndefined()
    expect(checkConformance([recorded], spec).violations).toEqual([])
  })
})
