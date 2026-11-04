import { b as ConformanceResult, c as ConformanceComparison, j as Recorder, O as OpenAPISpec, C as CoverageConfig, a as CoverageResult } from '../recorder-D5e9Fpe5.js';

interface MochaConformanceOptions {
    /** Known violations, by key. Matching violations are reported but do not fail the run. */
    baseline?: string[];
    /** Intended violations (e.g. an internal column the schema strips on purpose). `*` matches one segment. */
    allowed?: string[];
    /**
     * Throw when a violation is neither baselined nor allowed. Default false: report only, so a
     * first run can produce the baseline.
     */
    failOnNew?: boolean;
    /** If set, write the conformance report (result + comparison) as JSON to this path. */
    jsonReportPath?: string;
    /** Print the console summary. Default true. */
    console?: boolean | {
        maxItems?: number;
    };
    /** Called with the result and comparison, before the failure check. */
    onConformance?: (result: ConformanceResult, comparison: ConformanceComparison) => void;
}
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
    /**
     * Check recorded responses against the spec's response schemas (see `checkConformance`).
     * Off unless set. Needs the Fastify adapter's raw-body recording to see stripped fields.
     */
    conformance?: MochaConformanceOptions;
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

export { type MochaConformanceOptions, type MochaCoverageOptions, createCoverageAfterAll };
