import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Recorder } from '../recorder.js'

export interface FastifyCoverageOptions {
  /** Existing recorder instance. If omitted a new one is created and returned. */
  recorder?: Recorder
  /**
   * When true (default), wraps `app.inject()` so that every resolved inject
   * call automatically marks the response as asserted.
   */
  autoAssertOnInject?: boolean
}

/**
 * Register onSend + onResponse hooks on a Fastify instance to record
 * HTTP traffic for OpenAPI coverage.
 *
 * Returns the Recorder that accumulates calls. Pass it later to
 * `computeCoverage()` via `recorder.getCalls()`.
 *
 * @example
 * ```ts
 * import { registerCoverageHooks } from 'openapi-test-coverage/adapters/fastify'
 * const recorder = registerCoverageHooks(app)
 * ```
 */
export function registerCoverageHooks(
  app: FastifyInstance,
  options: FastifyCoverageOptions = {},
): Recorder {
  const recorder = options.recorder ?? new Recorder()
  const autoAssert = options.autoAssertOnInject !== false

  app.addHook('onSend', function onSendCapturePayload(
    request: FastifyRequest,
    _reply: FastifyReply,
    payload: unknown,
    done: (err?: Error, value?: unknown) => void,
  ) {
    ;(request as unknown as Record<string, unknown>)._openApiCoveragePayload = payload
    done()
  })

  app.addHook('onResponse', function onResponseRecordCoverage(
    request: FastifyRequest,
    reply: FastifyReply,
    done: (err?: Error) => void,
  ) {
    let pathname = request.url ? request.url.split('?')[0] : (request.raw?.url?.split('?')[0] || '/')
    pathname = pathname?.replace(/\/+$/, '') || '/'

    let responseBody: unknown = null
    const raw = (request as unknown as Record<string, unknown>)._openApiCoveragePayload
    if (raw !== undefined) {
      if (typeof raw === 'object' && raw !== null) {
        responseBody = raw
      } else if (typeof raw === 'string') {
        try {
          responseBody = JSON.parse(raw)
        } catch {
          responseBody = null
        }
      }
    }

    recorder.record({
      method: request.method,
      pathname,
      pathParams: (request.params as Record<string, string>) || {},
      queryParams: (request.query as Record<string, string>) || {},
      requestContentType: request.headers?.['content-type'] || null,
      responseStatusCode: reply.statusCode,
      responseContentType: (reply.getHeader?.('content-type') as string) || null,
      responseBody,
    })
    done()
  })

  if (autoAssert) {
    const originalInject = app.inject.bind(app)
    ;(app as unknown as Record<string, unknown>).inject = function injectWithAsserted(
      ...args: Parameters<typeof originalInject>
    ) {
      return originalInject(...args).then((result) => {
        recorder.markLastResponseAsserted()
        return result
      })
    }
  }

  return recorder
}
