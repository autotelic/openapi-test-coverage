export interface RecordedCall {
  method: string
  pathname: string
  pathParams?: Record<string, string>
  queryParams?: Record<string, string>
  requestContentType?: string | null
  responseStatusCode: number
  responseContentType?: string | null
  responseBody?: unknown
  /**
   * What the handler returned, before a schema-driven serializer shaped it, normalised through
   * JSON (`toJSON` applied, `undefined` dropped). Only an adapter that can see the payload before
   * serialization records it; without it, dropped fields and coerced types are invisible.
   */
  responseRawBody?: unknown
  /**
   * Where `responseRawBody` held a `Date` before the JSON snapshot turned it into an ISO
   * date-time string (coverage notation, `items[].at`). A schema-driven serializer formats a
   * `Date` to the declared `date`/`time`, so those format checks do not apply there.
   */
  responseRawDatePaths?: string[]
  /**
   * For an error response whose payload never reached the adapter before serialization: the
   * body the framework sends when no schema applies. Used only to detect dropped fields.
   */
  responseErrorBody?: unknown
  statusCodeAsserted?: boolean
}

export interface CoverageMetric {
  total: number
  covered: number
  missing: string[]
}

export interface CoverageResult {
  path: CoverageMetric
  operation: CoverageMetric
  statusCode: CoverageMetric
  parameter: CoverageMetric
  parameterValue: CoverageMetric
  inputContentType: CoverageMetric
  outputContentType: CoverageMetric
  statusCodeClass: CoverageMetric
  responseBodyProperties: CoverageMetric
  responseAsserted: CoverageMetric
  tcl: number
}

export interface CoverageConfig {
  excludedPaths?: string[]
  excludedResponseBodyProperties?: string[]
  excludedStatusCodes?: string[]
}

/**
 * - `schema`: the body breaks the response schema (checked before serialization when possible)
 * - `dropped`: a field the handler returned never reached the client
 * - `status`: the status code is not documented for the operation
 */
export type ConformanceKind = 'schema' | 'dropped' | 'status'

export interface ConformanceViolation {
  /**
   * Stable identity, used for baselines and allow-lists:
   * `GET /items/{id} 200 dropped items[].secret`, `GET /items/{id} 200 schema:type items[].price`,
   * `GET /items/{id} 409 status`.
   */
  key: string
  kind: ConformanceKind
  method: string
  path: string
  statusCode: string
  /** Property path in coverage notation (`items[].id`); empty for the whole body. */
  location: string
  /** The JSON Schema keyword that failed, for `schema` violations. */
  keyword?: string
  /** The first occurrence's message. */
  message: string
  /** How many recorded calls produced this violation. */
  count: number
  /** The first request that produced it, for reproducing. */
  example: string
}

export interface ConformanceResult {
  /** Recorded calls that matched a documented operation. */
  checked: number
  /** One entry per key, sorted by key. */
  violations: ConformanceViolation[]
  /** Response schemas that could not be compiled, and why. Their calls were not validated. */
  skipped: Array<{ schema: string; reason: string }>
}

export interface ConformanceComparison {
  /** Violations neither allowed nor in the baseline: the ones that should fail a run. */
  new: ConformanceViolation[]
  /** Violations recorded in the baseline: known debt. */
  baselined: ConformanceViolation[]
  /** Violations matching an allow-list entry: intended, never reported as stale. */
  allowed: ConformanceViolation[]
  /** Baseline entries that no longer occur, so the baseline can shrink. */
  stale: string[]
}

// Minimal OpenAPI 3.x types covering what the coverage tool uses.
// Consumers can pass a full spec object; these types just describe
// the subset we actually read.

export interface OpenAPISpec {
  openapi?: string
  paths?: Record<string, PathItem>
  servers?: Array<{ url: string }>
  components?: {
    schemas?: Record<string, SchemaObject>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface PathItem {
  get?: OperationObject
  post?: OperationObject
  put?: OperationObject
  patch?: OperationObject
  delete?: OperationObject
  head?: OperationObject
  options?: OperationObject
  parameters?: ParameterObject[]
  [key: string]: unknown
}

export interface OperationObject {
  parameters?: ParameterObject[]
  requestBody?: {
    content?: Record<string, MediaTypeObject>
    [key: string]: unknown
  }
  responses?: Record<string, ResponseObject>
  [key: string]: unknown
}

export interface ParameterObject {
  name: string
  in: string
  schema?: SchemaObject
  [key: string]: unknown
}

export interface ResponseObject {
  content?: Record<string, MediaTypeObject>
  [key: string]: unknown
}

export interface MediaTypeObject {
  schema?: SchemaObject
  [key: string]: unknown
}

export interface SchemaObject {
  type?: string
  properties?: Record<string, SchemaObject>
  items?: SchemaObject
  enum?: unknown[]
  $ref?: string
  allOf?: SchemaObject[]
  oneOf?: SchemaObject[]
  anyOf?: SchemaObject[]
  [key: string]: unknown
}

// Internal structures produced by the spec walker

export interface SpecOperation {
  path: string
  method: string
}

export interface SpecStatusCode {
  path: string
  method: string
  statusCode: string
}

export interface SpecParameter {
  path: string
  method: string
  paramName: string
  in: string
}

export interface SpecParameterValue {
  path: string
  method: string
  paramName: string
  in: string
  value: string
}

export interface SpecContentType {
  path: string
  method: string
  contentType: string
}

export interface SpecStatusCodeClass {
  path: string
  method: string
  class: string
}

export interface SpecResponseBodyProperty {
  path: string
  method: string
  statusCode: string
  contentType: string
  propertyPath: string
}

export interface WalkedSpec {
  paths: string[]
  operations: SpecOperation[]
  responseStatusCodes: SpecStatusCode[]
  parameters: SpecParameter[]
  parameterValues: SpecParameterValue[]
  inputContentTypes: SpecContentType[]
  outputContentTypes: SpecContentType[]
  statusCodeClasses: SpecStatusCodeClass[]
  responseBodyProperties: SpecResponseBodyProperty[]
}

export interface MatchResult {
  pathKey: string
  method: string
  pathParams: Record<string, string>
}

export interface TclInputs {
  pathCovered: number
  pathTotal: number
  operationCovered: number
  operationTotal: number
  inputContentTypeCovered: number
  inputContentTypeTotal: number
  outputContentTypeCovered: number
  outputContentTypeTotal: number
  parameterCovered: number
  parameterTotal: number
  statusCodeClassCovered: number
  statusCodeClassTotal: number
  statusCodeCovered: number
  statusCodeTotal: number
  parameterValueCovered: number
  parameterValueTotal: number
  responseBodyPropertiesCovered: number
  responseBodyPropertiesTotal: number
}
