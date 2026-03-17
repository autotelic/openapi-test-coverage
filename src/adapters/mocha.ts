import type { OpenAPISpec, CoverageConfig, CoverageResult } from '../types.js'
import type { Recorder } from '../recorder.js'
import { computeCoverage } from '../coverage.js'
import { printReport } from '../reporters/console.js'
import { writeJsonReport } from '../reporters/json.js'
import { writeHtmlReport } from '../reporters/html.js'

export interface MochaCoverageOptions {
  /** Return the Recorder that has been accumulating calls. */
  getRecorder: () => Recorder | null | undefined
  /** Return the resolved OpenAPI spec. */
  getSpec: () => OpenAPISpec | null | undefined
  /** Coverage exclusion config. */
  config?: CoverageConfig
  /** Print console report. Default true. */
  console?: boolean | { verbose?: boolean; maxMissingItems?: number }
  /** If set, write a JSON report to this path. Supports env var override. */
  jsonReportPath?: string
  /** If set, write an HTML report to this path. Supports env var override. */
  htmlReportPath?: string
  /**
   * Minimum TCL required. If the computed TCL is below this, the afterAll
   * hook throws (failing the test run). Supports env var override.
   */
  minTcl?: number
  /**
   * Called with the coverage result after computation, before threshold check.
   * Useful for custom assertions or side effects.
   */
  onCoverage?: (coverage: CoverageResult) => void
}

/**
 * Create a Mocha-compatible `afterAll` hook that computes OpenAPI coverage
 * and generates reports.
 *
 * @example
 * ```js
 * // In rootHooks.js
 * const { createCoverageAfterAll } = require('openapi-test-coverage/adapters/mocha')
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
export function createCoverageAfterAll(options: MochaCoverageOptions): () => void {
  return function openApiCoverageAfterAll() {
    const recorder = options.getRecorder()
    const spec = options.getSpec()
    if (!recorder || !spec) return

    const calls = recorder.getCalls()
    if (!calls.length) return

    const coverage = computeCoverage(calls, spec, options.config)

    const consoleOpts = options.console
    if (consoleOpts !== false) {
      const verbose = typeof consoleOpts === 'object' ? consoleOpts.verbose ?? false : false
      const maxMissingItems = typeof consoleOpts === 'object' ? consoleOpts.maxMissingItems : undefined
      printReport(coverage, { verbose, maxMissingItems })
    }

    const jsonPath = options.jsonReportPath
    if (jsonPath) {
      writeJsonReport(coverage, jsonPath)
    }

    const htmlPath = options.htmlReportPath
    if (htmlPath) {
      writeHtmlReport(coverage, htmlPath)
    }

    if (options.onCoverage) {
      options.onCoverage(coverage)
    }

    const minTcl = options.minTcl
    if (minTcl != null && !Number.isNaN(minTcl) && coverage.tcl < minTcl) {
      throw new Error(
        `OpenAPI coverage TCL ${coverage.tcl} is below required minimum ${minTcl}. ` +
          'Set OPENAPI_COVERAGE_MIN_TCL to override (e.g. 5 to allow lower).',
      )
    }
  }
}
