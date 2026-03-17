// Core
export { Recorder, isOperationKey } from './recorder.js'
export { computeCoverage, computeTcl } from './coverage.js'
export { walkSpec } from './spec-walker.js'
export { matchRequestToSpec, stripBasePath, pathTemplateToRegex } from './matcher.js'
export { getBasePath, getConfig } from './config.js'
export { resolveSchemaRef, collectSchemaPaths, collectPathsFromValue } from './schema-utils.js'

// Reporters
export { printReport, writeJsonReport, writeHtmlReport } from './reporters/index.js'
export type { PrintReportOptions } from './reporters/index.js'

// Types
export type {
  RecordedCall,
  CoverageMetric,
  CoverageResult,
  CoverageConfig,
  OpenAPISpec,
  PathItem,
  OperationObject,
  ParameterObject,
  ResponseObject,
  MediaTypeObject,
  SchemaObject,
  SpecOperation,
  SpecStatusCode,
  SpecParameter,
  SpecParameterValue,
  SpecContentType,
  SpecStatusCodeClass,
  SpecResponseBodyProperty,
  WalkedSpec,
  MatchResult,
  TclInputs,
} from './types.js'
