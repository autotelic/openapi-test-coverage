# @autotelic/openapi-test-coverage

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
npm install @autotelic/openapi-test-coverage
```

Or from git:

```bash
npm install https://github.com/autotelic/openapi-test-coverage.git
```

## Quick Start

### 1. Record HTTP calls

Use the Fastify adapter to automatically record all requests and responses:

```js
const { registerCoverageHooks } = require('@autotelic/openapi-test-coverage/adapters/fastify')

// After creating your Fastify app and registering routes:
const recorder = registerCoverageHooks(app, { autoAssertOnInject: true })

await app.ready()
```

Or record manually with the core `Recorder`:

```js
const { Recorder } = require('@autotelic/openapi-test-coverage')

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
const { computeCoverage } = require('@autotelic/openapi-test-coverage')

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
const { printReport, writeJsonReport, writeHtmlReport } = require('@autotelic/openapi-test-coverage')

printReport(coverage, { verbose: true })

writeJsonReport(coverage, 'test/output/openapi-coverage.json')
writeHtmlReport(coverage, 'test/output/openapi-coverage.html')
```

## Adapters

### Fastify

`registerCoverageHooks(app, options?)` registers `onSend` and `onResponse` hooks on a Fastify instance (plus `preSerialization` and `onError` when recording raw bodies). Returns a `Recorder`.

```js
const { registerCoverageHooks } = require('@autotelic/openapi-test-coverage/adapters/fastify')

const recorder = registerCoverageHooks(app, {
  // Pass an existing recorder (optional, creates one if omitted)
  recorder: myRecorder,
  // Wrap app.inject() to auto-mark responses as asserted (default: true)
  autoAssertOnInject: true,
  // Also record the handler's body before serialization, for conformance (default: true)
  recordRawBody: true,
})
```

### Mocha

`createCoverageAfterAll(options)` returns a function suitable for use in Mocha's `afterAll` hook. It computes coverage, prints reports, and optionally enforces a minimum TCL.

```js
const { createCoverageAfterAll } = require('@autotelic/openapi-test-coverage/adapters/mocha')

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
| `checkConformance(calls, spec, config?)` | Check recorded responses against their response schemas; see [Response Conformance](#response-conformance). Returns a `ConformanceResult`. |
| `compareConformance(result, { baseline?, allowed? })` | Sort violations into `new`, `baselined`, and `allowed`, and list `stale` baseline entries. |
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
| `printConformanceReport(result, comparison, opts?)` | Print the conformance summary and new violations. Options: `{ maxItems: number }`. |
| `writeConformanceJsonReport(result, comparison, filepath)` | Write the conformance report as JSON, including `baselineKeys`. |

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

## Response Conformance

Coverage says which parts of the spec the tests reached. Conformance says whether the responses they got back actually match it.

That needs more than validating the response the client received. Fastify serializes a response through its route schema, and the serializer forces the body into shape: fields the schema does not declare are **silently dropped**, and wrong types are **coerced** (`null` becomes `0` or `""`). The body that leaves the server always looks valid. So the Fastify adapter also records what the handler returned before serialization (`responseRawBody`), and `checkConformance` reports three kinds of violation:

| Kind | Meaning | Key |
|------|---------|-----|
| `schema` | The handler's body breaks the response schema (type, enum, format, required, …). | `GET /items/{id} 200 schema:type price` |
| `dropped` | A field the handler returned never reached the client: the schema does not declare it. | `GET /items/{id} 200 dropped items[].secret` |
| `status` | The status code is not documented for the operation (exact, `4XX` range, or `default`). | `GET /items/{id} 500 status` |

Fastify's default error handler serializes an error without running `preSerialization`, so on that path the adapter records the body Fastify sends when no schema applies (`statusCode`, `code`, `error`, `message`). A response schema that strips any of those is reported as `dropped`. That is how a 409 whose schema declares only a custom field reaches the client as `{ "undoRefusal": "…" }` and nothing else.

```js
const { checkConformance, compareConformance } = require('@autotelic/openapi-test-coverage')

const result = checkConformance(recorder.getCalls(), openapiSpec, { excludedPaths: [] })
const comparison = compareConformance(result, {
  baseline: require('./openapi-conformance-baseline.json'), // known debt; entries that stop occurring come back as `stale`
  allowed: ['* * * dropped password_hash'],                // intended; `*` matches one key segment
  // allowed: ['**.tenant_id'],                            // `**.field` matches by leaf field name, any route
})
comparison.new // violations that should fail a run
```

With Mocha, pass `conformance` to `createCoverageAfterAll`. It reports only, unless `failOnNew` is set. The JSON report's `baselineKeys` is the baseline that accepts the current state, so a first run produces it:

```js
createCoverageAfterAll({
  getRecorder: () => app.coverageRecorder,
  getSpec: () => app.openapiSpec,
  conformance: {
    baseline: require('../openapi-conformance-baseline.json'),
    allowed: [],
    failOnNew: process.env.OPENAPI_CONFORMANCE_FAIL === '1',
    jsonReportPath: process.env.OPENAPI_CONFORMANCE_JSON,
  },
})
```

Schemas are validated with Ajv against the spec document itself, not the framework's copy of it. OpenAPI 3.0's `nullable` and boolean `exclusiveMinimum`/`exclusiveMaximum` are rewritten to their JSON Schema meaning first, and 3.1 specs use JSON Schema 2020-12. A schema that cannot compile is listed in `result.skipped` and its responses are not checked. The run does not fail on it.

Keys write array children as `items[].id` — coverage keys, conformance keys, and so `excludedResponseBodyProperties` all use the one notation. (Before 0.3.0 coverage keys used `items[]..id`; exclusion lists written against 0.2.x must drop the second dot.)

## Development

```bash
pnpm install
pnpm build        # Build CJS + ESM + .d.ts
pnpm test         # Run vitest
pnpm typecheck    # tsc --noEmit
```

## License

MIT
