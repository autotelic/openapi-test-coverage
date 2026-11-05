import type {
  OpenAPISpec,
  CoverageConfig,
  CoverageResult,
  ConformanceResult,
  ConformanceComparison,
} from '../types.js'
import type { Recorder } from '../recorder.js'
import { computeCoverage } from '../coverage.js'
import { checkConformance, compareConformance } from '../conformance.js'
import { printReport, printConformanceReport } from '../reporters/console.js'
import { writeJsonReport, writeConformanceJsonReport } from '../reporters/json.js'
import { writeHtmlReport } from '../reporters/html.js'

export interface MochaConformanceOptions {
  /** Known violations, by key. Matching violations are reported but do not fail the run. */
  baseline?: string[]
  /** Intended violations (e.g. an internal column the schema strips on purpose). `*` matches one segment. */
  allowed?: string[]
  /**
   * Throw when a violation is neither baselined nor allowed. Default false: report only, so a
   * first run can produce the baseline.
   */
  failOnNew?: boolean
  /** If set, write the conformance report (result + comparison) as JSON to this path. */
  jsonReportPath?: string
  /** Print the console summary. Default true. */
  console?: boolean | { maxItems?: number }
  /** Called with the result and comparison, before the failure check. */
  onConformance?: (result: ConformanceResult, comparison: ConformanceComparison) => void
}

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
  /**
   * Check recorded responses against the spec's response schemas (see `checkConformance`).
   * Off unless set. Needs the Fastify adapter's raw-body recording to see stripped fields.
   */
  conformance?: MochaConformanceOptions
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

    const failures: string[] = []

    const minTcl = options.minTcl
    if (minTcl != null && !Number.isNaN(minTcl) && coverage.tcl < minTcl) {
      failures.push(
        `OpenAPI coverage TCL ${coverage.tcl} is below required minimum ${minTcl}. ` +
          'Set OPENAPI_COVERAGE_MIN_TCL to override (e.g. 5 to allow lower).',
      )
    }

    const conformanceOptions = options.conformance
    if (conformanceOptions) {
      const result = checkConformance(calls, spec, options.config)
      const comparison = compareConformance(result, conformanceOptions)

      const conformanceConsole = conformanceOptions.console
      if (conformanceConsole !== false) {
        const maxItems = typeof conformanceConsole === 'object' ? conformanceConsole.maxItems : undefined
        printConformanceReport(result, comparison, { maxItems })
      }
      if (conformanceOptions.jsonReportPath) {
        writeConformanceJsonReport(result, comparison, conformanceOptions.jsonReportPath)
      }
      if (conformanceOptions.onConformance) {
        conformanceOptions.onConformance(result, comparison)
      }
      if (conformanceOptions.failOnNew && comparison.new.length > 0) {
        failures.push(
          `${comparison.new.length} new response conformance violation(s): ` +
            comparison.new.slice(0, 5).map(v => v.key).join('; ') +
            (comparison.new.length > 5 ? '; …' : '') +
            '. Fix the handler or the spec; the conformance baseline records existing debt, not new violations.',
        )
      }
    }

    if (failures.length > 0) {
      throw new Error(failures.join('\n'))
    }
  }
}
