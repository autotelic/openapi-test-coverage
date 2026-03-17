# openapi-test-coverage

OpenAPI test coverage analysis based on the [A-TEST '19 paper](./Test_Coverage_Criteria_for_RESTful_Web_APIs.pdf) "Test Coverage Criteria for RESTful Web APIs" (Martin-Lopez, Segura, Ruiz-Cortes).

Records HTTP traffic during integration tests, computes coverage against an OpenAPI 3.x spec, and reports results across 10 criteria organised into Test Coverage Levels (TCL 0--7).

## Coverage Criteria

| TCL | Criteria added |
|-----|----------------|
| 0 | (none) |
| 1 | Path coverage |
| 2 | + Operation coverage |
| 3 | + Input and output content-type coverage |
| 4 | + Parameter coverage, status code class coverage |
| 5 | + Parameter value coverage, status code coverage |
| 6 | + Response body properties coverage |
| 7 | + Operation flow coverage (not yet implemented) |

## Install

```bash
npm install openapi-test-coverage
```

Or from git:

```bash
npm install https://github.com/autotelic/openapi-test-coverage.git
```

## Quick Start

### 1. Record HTTP calls

Use the Fastify adapter to automatically record all requests and responses:

```js
const { registerCoverageHooks } = require('openapi-test-coverage/adapters/fastify')

// After creating your Fastify app and registering routes:
const recorder = registerCoverageHooks(app, { autoAssertOnInject: true })

await app.ready()
```

Or record manually with the core `Recorder`:

```js
const { Recorder } = require('openapi-test-coverage')

const recorder = new Recorder()

recorder.record({
  method: 'GET',
  pathname: '/v1/items',
  queryParams: { limit: '10' },
  responseStatusCode: 200,
  responseContentType: 'application/json',
  responseBody: [{ id: '1', name: 'Item' }],
})
```

### 2. Compute coverage

```js
const { computeCoverage } = require('openapi-test-coverage')

const coverage = computeCoverage(recorder.getCalls(), openapiSpec, {
  excludedPaths: ['/internal/health'],
  excludedStatusCodes: ['/legacy\tGET\t404'],
})

console.log(`TCL: ${coverage.tcl}`)
console.log(`Paths: ${coverage.path.covered}/${coverage.path.total}`)
console.log(`Operations: ${coverage.operation.covered}/${coverage.operation.total}`)
```

### 3. Report

```js
const { printReport, writeJsonReport, writeHtmlReport } = require('openapi-test-coverage')

printReport(coverage, { verbose: true })

writeJsonReport(coverage, 'test/output/openapi-coverage.json')
writeHtmlReport(coverage, 'test/output/openapi-coverage.html')
```

## Adapters

### Fastify

`registerCoverageHooks(app, options?)` registers `onSend` and `onResponse` hooks on a Fastify instance. Returns a `Recorder`.

```js
const { registerCoverageHooks } = require('openapi-test-coverage/adapters/fastify')

const recorder = registerCoverageHooks(app, {
  // Pass an existing recorder (optional, creates one if omitted)
  recorder: myRecorder,
  // Wrap app.inject() to auto-mark responses as asserted (default: true)
  autoAssertOnInject: true,
})
```

### Mocha

`createCoverageAfterAll(options)` returns a function suitable for use in Mocha's `afterAll` hook. It computes coverage, prints reports, and optionally enforces a minimum TCL.

```js
const { createCoverageAfterAll } = require('openapi-test-coverage/adapters/mocha')

module.exports.mochaHooks = {
  async beforeAll() {
    // ... set up app, spec, recorder ...
  },
  async afterAll() {
    const reportCoverage = createCoverageAfterAll({
      getRecorder: () => app.coverageRecorder,
      getSpec: () => app.openapiSpec,
      config: {
        excludedPaths: [],
        excludedStatusCodes: [],
        excludedResponseBodyProperties: [],
      },
      console: { verbose: true },
      jsonReportPath: process.env.OPENAPI_COVERAGE_JSON,
      htmlReportPath: process.env.OPENAPI_COVERAGE_HTML,
      minTcl: 6,
    })
    reportCoverage()

    await app.close()
  },
}
```

## API

### Core

| Export | Description |
|--------|-------------|
| `Recorder` | Class that stores recorded HTTP calls. Methods: `record(opts)`, `markLastResponseAsserted()`, `getCalls()`, `clear()`. |
| `computeCoverage(calls, spec, config?)` | Compute all coverage metrics and TCL from recorded calls against an OpenAPI spec. Returns a `CoverageResult`. |
| `computeTcl(inputs)` | Compute the TCL (0--6) from individual metric totals/covered counts. |
| `walkSpec(spec, excludedPaths?)` | Extract all coverage targets (paths, operations, parameters, etc.) from a resolved OpenAPI spec. |
| `matchRequestToSpec(call, specPaths, basePath)` | Match a recorded request to a spec path template. |
| `getBasePath(spec)` | Derive the base path from the spec's `servers[0].url`. |
| `collectSchemaPaths(spec, schema)` | Collect all property paths from an OpenAPI schema (for response body coverage). |
| `collectPathsFromValue(value)` | Collect property paths from an actual JSON response body. |

### Reporters

| Export | Description |
|--------|-------------|
| `printReport(coverage, opts?)` | Print a coloured console report. Options: `{ verbose: boolean, maxMissingItems: number }`. |
| `writeJsonReport(coverage, filepath)` | Write coverage as JSON. Creates parent directories if needed. |
| `writeHtmlReport(coverage, filepath)` | Write a standalone HTML report. |

### Configuration

`CoverageConfig` supports three exclusion lists:

- **`excludedPaths`** -- Path keys to omit entirely (e.g. `['/admin/reports']`).
- **`excludedStatusCodes`** -- Tab-separated `path\tmethod\tstatusCode` keys to exclude from status code and response body coverage.
- **`excludedResponseBodyProperties`** -- Tab-separated `path\tmethod\tstatusCode\tcontentType\tpropertyPath` keys to exclude from response body property coverage.

### Environment Variables

These are conventions used by the Mocha adapter; the core library is env-agnostic.

| Variable | Description |
|----------|-------------|
| `OPENAPI_COVERAGE_JSON` | Path to write a JSON coverage report. |
| `OPENAPI_COVERAGE_HTML` | Path to write an HTML coverage report. |
| `OPENAPI_COVERAGE_MIN_TCL` | Minimum TCL required; test run fails if below this. |

## Coverage Result Shape

```ts
interface CoverageResult {
  path:                   { total: number; covered: number; missing: string[] }
  operation:              { total: number; covered: number; missing: string[] }
  statusCode:             { total: number; covered: number; missing: string[] }
  parameter:              { total: number; covered: number; missing: string[] }
  parameterValue:         { total: number; covered: number; missing: string[] }
  inputContentType:       { total: number; covered: number; missing: string[] }
  outputContentType:      { total: number; covered: number; missing: string[] }
  statusCodeClass:        { total: number; covered: number; missing: string[] }
  responseBodyProperties: { total: number; covered: number; missing: string[] }
  responseAsserted:       { total: number; covered: number; missing: string[] }
  tcl: number
}
```

## Development

```bash
pnpm install
pnpm build        # Build CJS + ESM + .d.ts
pnpm test         # Run vitest
pnpm typecheck    # tsc --noEmit
```

## License

MIT
