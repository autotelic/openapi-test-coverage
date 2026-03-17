import { describe, it, expect } from 'vitest'
import { matchRequestToSpec, stripBasePath, pathTemplateToRegex } from '../src/matcher.js'

describe('stripBasePath', () => {
  it('removes /v1 prefix', () => {
    expect(stripBasePath('/v1/seasons', '/v1')).toBe('/seasons')
  })

  it('returns / for exact base path match', () => {
    expect(stripBasePath('/v1', '/v1')).toBe('/')
  })

  it('returns path unchanged when no base path', () => {
    expect(stripBasePath('/seasons', '')).toBe('/seasons')
  })

  it('handles missing pathname', () => {
    expect(stripBasePath('', '/v1')).toBe('/')
  })
})

describe('pathTemplateToRegex', () => {
  it('creates regex and extracts param names', () => {
    const { regex, paramNames } = pathTemplateToRegex('/items/{id}')
    expect(paramNames).toEqual(['id'])
    expect(regex.test('/items/abc')).toBe(true)
    expect(regex.test('/items')).toBe(false)
  })

  it('handles multiple params', () => {
    const { regex, paramNames } = pathTemplateToRegex('/users/{userId}/posts/{postId}')
    expect(paramNames).toEqual(['userId', 'postId'])
    const match = '/users/123/posts/456'.match(regex)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('123')
    expect(match![2]).toBe('456')
  })
})

describe('matchRequestToSpec', () => {
  const specPaths = ['/items', '/items/{id}', '/items/{id}/reviews']

  it('matches exact paths', () => {
    const result = matchRequestToSpec({ method: 'GET', pathname: '/v1/items' }, specPaths, '/v1')
    expect(result).toEqual({ pathKey: '/items', method: 'GET', pathParams: {} })
  })

  it('matches parameterised paths', () => {
    const result = matchRequestToSpec({ method: 'GET', pathname: '/v1/items/abc' }, specPaths, '/v1')
    expect(result).toEqual({ pathKey: '/items/{id}', method: 'GET', pathParams: { id: 'abc' } })
  })

  it('prefers longer (more specific) templates', () => {
    const result = matchRequestToSpec({ method: 'GET', pathname: '/v1/items/abc/reviews' }, specPaths, '/v1')
    expect(result).toEqual({ pathKey: '/items/{id}/reviews', method: 'GET', pathParams: { id: 'abc' } })
  })

  it('returns null for unmatched paths', () => {
    const result = matchRequestToSpec({ method: 'GET', pathname: '/v1/other' }, specPaths, '/v1')
    expect(result).toBeNull()
  })

  it('normalises trailing slashes', () => {
    const result = matchRequestToSpec({ method: 'GET', pathname: '/v1/items/' }, specPaths, '/v1')
    expect(result?.pathKey).toBe('/items')
  })
})
