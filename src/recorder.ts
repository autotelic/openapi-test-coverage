import type { RecordedCall } from './types.js'

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

export class Recorder {
  private _calls: RecordedCall[] = []

  record(opts: Omit<RecordedCall, 'statusCodeAsserted'>): void {
    this._calls.push({
      method: (opts.method || '').toUpperCase(),
      pathname: opts.pathname || '',
      pathParams: opts.pathParams || {},
      queryParams: opts.queryParams || {},
      requestContentType: opts.requestContentType ?? null,
      responseStatusCode: opts.responseStatusCode,
      responseContentType: opts.responseContentType ?? null,
      responseBody: opts.responseBody !== undefined ? opts.responseBody : null,
      statusCodeAsserted: false,
    })
  }

  markLastResponseAsserted(): void {
    if (this._calls.length > 0) {
      this._calls[this._calls.length - 1].statusCodeAsserted = true
    }
  }

  getCalls(): RecordedCall[] {
    return this._calls
  }

  clear(): void {
    this._calls = []
  }
}

export function isOperationKey(key: string): boolean {
  return HTTP_METHODS.has(key.toLowerCase())
}
