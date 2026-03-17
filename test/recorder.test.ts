import { describe, it, expect } from 'vitest'
import { Recorder, isOperationKey } from '../src/recorder.js'

describe('Recorder', () => {
  it('records calls and returns them', () => {
    const recorder = new Recorder()
    recorder.record({ method: 'GET', pathname: '/items', responseStatusCode: 200 })
    recorder.record({ method: 'POST', pathname: '/items', responseStatusCode: 201 })
    expect(recorder.getCalls()).toHaveLength(2)
    expect(recorder.getCalls()[0].method).toBe('GET')
    expect(recorder.getCalls()[1].method).toBe('POST')
  })

  it('normalises method to uppercase', () => {
    const recorder = new Recorder()
    recorder.record({ method: 'get', pathname: '/items', responseStatusCode: 200 })
    expect(recorder.getCalls()[0].method).toBe('GET')
  })

  it('defaults statusCodeAsserted to false', () => {
    const recorder = new Recorder()
    recorder.record({ method: 'GET', pathname: '/items', responseStatusCode: 200 })
    expect(recorder.getCalls()[0].statusCodeAsserted).toBe(false)
  })

  it('marks the last response as asserted', () => {
    const recorder = new Recorder()
    recorder.record({ method: 'GET', pathname: '/a', responseStatusCode: 200 })
    recorder.record({ method: 'GET', pathname: '/b', responseStatusCode: 200 })
    recorder.markLastResponseAsserted()
    expect(recorder.getCalls()[0].statusCodeAsserted).toBe(false)
    expect(recorder.getCalls()[1].statusCodeAsserted).toBe(true)
  })

  it('clears all calls', () => {
    const recorder = new Recorder()
    recorder.record({ method: 'GET', pathname: '/items', responseStatusCode: 200 })
    recorder.clear()
    expect(recorder.getCalls()).toHaveLength(0)
  })
})

describe('isOperationKey', () => {
  it('returns true for HTTP methods', () => {
    expect(isOperationKey('get')).toBe(true)
    expect(isOperationKey('POST')).toBe(true)
    expect(isOperationKey('delete')).toBe(true)
  })

  it('returns false for non-method keys', () => {
    expect(isOperationKey('parameters')).toBe(false)
    expect(isOperationKey('$ref')).toBe(false)
  })
})
