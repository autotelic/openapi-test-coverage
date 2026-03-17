import { FastifyInstance } from 'fastify';
import { f as Recorder } from '../recorder-QBQBCtUG.cjs';

interface FastifyCoverageOptions {
    /** Existing recorder instance. If omitted a new one is created and returned. */
    recorder?: Recorder;
    /**
     * When true (default), wraps `app.inject()` so that every resolved inject
     * call automatically marks the response as asserted.
     */
    autoAssertOnInject?: boolean;
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
declare function registerCoverageHooks(app: FastifyInstance, options?: FastifyCoverageOptions): Recorder;

export { type FastifyCoverageOptions, registerCoverageHooks };
