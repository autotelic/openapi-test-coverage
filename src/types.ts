export interface RecordedCall {
  method: string
  pathname: string
  pathParams?: Record<string, string>
  queryParams?: Record<string, string>
  requestContentType?: string | null
  responseStatusCode: number
  responseContentType?: string | null
  responseBody?: unknown
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
