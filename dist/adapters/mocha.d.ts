import { f as Recorder, O as OpenAPISpec, C as CoverageConfig, a as CoverageResult } from '../recorder-QBQBCtUG.js';

interface MochaCoverageOptions {
    /** Return the Recorder that has been accumulating calls. */
    getRecorder: () => Recorder | null | undefined;
    /** Return the resolved OpenAPI spec. */
    getSpec: () => OpenAPISpec | null | undefined;
    /** Coverage exclusion config. */
    config?: CoverageConfig;
    /** Print console report. Default true. */
    console?: boolean | {
        verbose?: boolean;
        maxMissingItems?: number;
    };
    /** If set, write a JSON report to this path. Supports env var override. */
    jsonReportPath?: string;
    /** If set, write an HTML report to this path. Supports env var override. */
    htmlReportPath?: string;
    /**
     * Minimum TCL required. If the computed TCL is below this, the afterAll
     * hook throws (failing the test run). Supports env var override.
     */
    minTcl?: number;
    /**
     * Called with the coverage result after computation, before threshold check.
     * Useful for custom assertions or side effects.
     */
    onCoverage?: (coverage: CoverageResult) => void;
}
/**
 * Create a Mocha-compatible `afterAll` hook that computes OpenAPI coverage
 * and generates reports.
 *
 * @example
 * ```js
 * // In rootHooks.js
 * const { createCoverageAfterAll } = require('@autotelic/openapi-test-coverage/adapters/mocha')
 *
 * module.exports.mochaHooks = {
 *   async afterAll() {
 *     const afterAll = createCoverageAfterAll({
 *       getRecorder: () => app.openapiCoverageRecorder,
 *       getSpec: () => app.openapispec,
 *       config: { excludedPaths: ['/admin/reports'] },
 *       console: { verbose: true },
 *       jsonReportPath: process.env.OPENAPI_COVERAGE_JSON,
 *       htmlReportPath: process.env.OPENAPI_COVERAGE_HTML,
 *       minTcl: parseInt(process.env.OPENAPI_COVERAGE_MIN_TCL ?? '6', 10),
 *     })
 *     afterAll()
 *     // ... other afterAll cleanup
 *   }
 * }
 * ```
 */
declare function createCoverageAfterAll(options: MochaCoverageOptions): () => void;

export { type MochaCoverageOptions, createCoverageAfterAll };
