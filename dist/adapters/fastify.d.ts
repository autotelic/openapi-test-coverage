import { FastifyInstance } from 'fastify';
import { j as Recorder } from '../recorder-B_KoKHOJ.js';

interface FastifyCoverageOptions {
    /** Existing recorder instance. If omitted a new one is created and returned. */
    recorder?: Recorder;
    /**
     * When true (default), wraps `app.inject()` so that every resolved inject
     * call automatically marks the response as asserted.
     */
    autoAssertOnInject?: boolean;
    /**
     * When true (default), also record what the handler returned before Fastify serialized it,
     * so `checkConformance()` can see fields the response schema stripped and values it coerced.
     */
    recordRawBody?: boolean;
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
declare function registerCoverageHooks(app: FastifyInstance, options?: FastifyCoverageOptions): Recorder;

export { type FastifyCoverageOptions, registerCoverageHooks };
