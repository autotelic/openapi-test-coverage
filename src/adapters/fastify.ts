import { STATUS_CODES } from 'node:http'
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
  /**
   * When true (default), also record what the handler returned before Fastify serialized it,
   * so `checkConformance()` can see fields the response schema stripped and values it coerced.
   */
  recordRawBody?: boolean
}

const RAW_BODY = Symbol('openApiCoverageRawBody')
const RAW_DATE_PATHS = Symbol('openApiCoverageRawDatePaths')
const ERROR_BODY = Symbol('openApiCoverageErrorBody')

type RecordingRequest = FastifyRequest & {
  [RAW_BODY]?: unknown
  [RAW_DATE_PATHS]?: string[]
  [ERROR_BODY]?: unknown
}

/** Where a payload holds `Date` objects, in coverage notation (`items[].at`). */
function datePathsOf(value: unknown, path = '', out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 64 || value === null || typeof value !== 'object') return out
  if (value instanceof Date) {
    out.add(path)
  } else if (Array.isArray(value)) {
    for (const item of value) datePathsOf(item, `${path}[]`, out, depth + 1)
  } else {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      datePathsOf(child, path === '' ? key : `${path}.${key}`, out, depth + 1)
    }
  }
  return out
}

/** Snapshot through JSON, as any serializer would see it: `toJSON` applied, `undefined` gone. */
function snapshot(payload: unknown): { body: unknown; datePaths: string[] } | undefined {
  try {
    return { body: JSON.parse(JSON.stringify(payload)), datePaths: [...datePathsOf(payload)] }
  } catch {
    return undefined
  }
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
 * import { registerCoverageHooks } from '@autotelic/openapi-test-coverage/adapters/fastify'
 * const recorder = registerCoverageHooks(app)
 * ```
 */
export function registerCoverageHooks(
  app: FastifyInstance,
  options: FastifyCoverageOptions = {},
): Recorder {
  const recorder = options.recorder ?? new Recorder()
  const autoAssert = options.autoAssertOnInject !== false
  const recordRawBody = options.recordRawBody !== false

  if (recordRawBody) {
    app.addHook('preSerialization', function preSerializationCaptureRawBody(
      request: FastifyRequest,
      _reply: FastifyReply,
      payload: unknown,
      done: (err: Error | null, value?: unknown) => void,
    ) {
      const taken = snapshot(payload)
      if (taken) {
        ;(request as RecordingRequest)[RAW_BODY] = taken.body
        ;(request as RecordingRequest)[RAW_DATE_PATHS] = taken.datePaths
      }
      done(null, payload)
    })

    // Fastify's default error handler serializes an error without running preSerialization, so
    // the raw body is lost on that path. Record instead what Fastify sends for the error when no
    // schema applies; a response schema that drops part of it has stripped the error's meaning.
    app.addHook('onError', function onErrorCaptureErrorBody(
      request: FastifyRequest,
      reply: FastifyReply,
      error: Error & { code?: unknown; statusCode?: unknown },
      done: () => void,
    ) {
      const statusCode = reply.statusCode >= 400 ? reply.statusCode : Number(error.statusCode) || 500
      ;(request as RecordingRequest)[ERROR_BODY] = {
        statusCode,
        ...(error.code !== undefined ? { code: error.code } : {}),
        error: STATUS_CODES[statusCode] ?? 'Error',
        message: error.message,
      }
      done()
    })
  }

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
      responseRawBody: (request as RecordingRequest)[RAW_BODY],
      responseRawDatePaths: (request as RecordingRequest)[RAW_DATE_PATHS],
      responseErrorBody: (request as RecordingRequest)[RAW_BODY] === undefined
        ? (request as RecordingRequest)[ERROR_BODY]
        : undefined,
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
