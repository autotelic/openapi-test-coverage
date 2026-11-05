import { describe, it, expect } from 'vitest'
import { collectSchemaPaths, collectPathsFromValue } from '../src/schema-utils.js'
import type { OpenAPISpec } from '../src/types.js'

const spec: OpenAPISpec = { openapi: '3.0.3', paths: {} }

describe('collectSchemaPaths', () => {
  it('writes array children as items[].id', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    }
    expect(collectSchemaPaths(spec, schema)).toEqual(['id', 'items', 'items[]', 'items[].id', 'items[].tags', 'items[].tags[]'])
  })

  it('writes nested arrays as matrix[][].id and a top-level array as [].id', () => {
    const nested = {
      type: 'object',
      properties: {
        matrix: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
      },
    }
    expect(collectSchemaPaths(spec, nested)).toEqual(['matrix', 'matrix[]', 'matrix[][]', 'matrix[][].id'])

    const topLevel = { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } }
    expect(collectSchemaPaths(spec, topLevel)).toEqual(['[]', '[].id'])
  })
})

describe('collectPathsFromValue', () => {
  it('writes array children as items[].id, matching collectSchemaPaths', () => {
    const value = { items: [{ id: 'a', tags: ['x'] }] }
    expect(collectPathsFromValue(value)).toEqual(['items', 'items[]', 'items[].id', 'items[].tags', 'items[].tags[]'])
  })

  it('writes a top-level array as [].id', () => {
    expect(collectPathsFromValue([{ id: 'a' }])).toEqual(['[]', '[].id'])
  })
})
