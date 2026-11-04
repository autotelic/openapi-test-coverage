import { R as RecordedCall, O as OpenAPISpec, C as CoverageConfig, a as CoverageResult, T as TclInputs, W as WalkedSpec, b as ConformanceResult, c as ConformanceComparison, M as MatchResult, S as SchemaObject } from './recorder-B_KoKHOJ.js';
export { d as ConformanceKind, e as ConformanceViolation, f as CoverageMetric, g as MediaTypeObject, h as OperationObject, P as ParameterObject, i as PathItem, j as Recorder, k as ResponseObject, l as SpecContentType, m as SpecOperation, n as SpecParameter, o as SpecParameterValue, p as SpecResponseBodyProperty, q as SpecStatusCode, r as SpecStatusCodeClass, s as isOperationKey } from './recorder-B_KoKHOJ.js';

declare function computeCoverage(recordedCalls: RecordedCall[], spec: OpenAPISpec, config?: CoverageConfig): CoverageResult;
/**
 * TCL 0-6: cumulative coverage levels per A-TEST '19.
 * TCL 1=paths, 2=+operations, 3=+content-types, 4=+params+statusClass,
 * 5=+param values+statusCodes, 6=+response body properties.
 */
declare function computeTcl(c: TclInputs): number;

/**
 * Walk a resolved OpenAPI spec and extract all coverage targets:
 * paths, operations, status codes, parameters, parameter values,
 * input/output content-types, status code classes, and response body properties.
 */
declare function walkSpec(spec: OpenAPISpec, excludedPaths?: string[]): WalkedSpec;

/**
 * Check recorded responses against the spec: does each body match its schema, did any field the
 * handler returned go missing on the way out, and is each status code documented?
 *
 * The schema check prefers `responseRawBody` (what the handler returned), because a
 * schema-driven serializer coerces and strips until the sent body looks valid. Calls that match
 * no documented operation are ignored; coverage reports those.
 */
declare function checkConformance(recordedCalls: RecordedCall[], spec: OpenAPISpec, config?: CoverageConfig): ConformanceResult;
/**
 * Sort violations into new, baselined, and allowed. The baseline is debt and should shrink, so
 * entries that no longer occur come back as `stale`; the allow-list is intent and never does.
 */
declare function compareConformance(result: ConformanceResult, options?: {
    baseline?: string[];
    allowed?: string[];
}): ConformanceComparison;

declare function stripBasePath(pathname: string, basePath: string): string;
declare function pathTemplateToRegex(pathTemplate: string): {
    regex: RegExp;
    paramNames: string[];
};
/**
 * Most specific template first: deeper paths, then fewer parameters, then longer text.
 * Length alone is not enough: `/projects/{projectId}` is longer than `/projects/table` and
 * would claim `/projects/table` as a project id.
 */
declare function compareTemplateSpecificity(a: string, b: string): number;
/**
 * Match a recorded request to a spec path template. Returns the matched
 * path key, normalised method, and extracted path params; or null if no
 * spec path matches.
 */
declare function matchRequestToSpec(recordedCall: Pick<RecordedCall, 'method' | 'pathname'>, specPathKeys: string[], basePath: string): MatchResult | null;

declare function getBasePath(spec: OpenAPISpec): string;
interface ResolvedConfig {
    basePath: string;
    excludedPaths: string[];
    excludedResponseBodyProperties: string[];
    excludedStatusCodes: string[];
}
declare function getConfig(spec: OpenAPISpec, excludedPaths?: string[], excludedResponseBodyProperties?: string[], excludedStatusCodes?: string[]): ResolvedConfig;

declare function resolveSchemaRef(spec: OpenAPISpec, schema: SchemaObject | null | undefined): SchemaObject | null;
/**
 * Collect all property paths from an OpenAPI schema (for response body coverage).
 * Paths use dot notation; arrays use "[]" suffix, e.g. "items[].id".
 */
declare function collectSchemaPaths(spec: OpenAPISpec, schema: SchemaObject | null | undefined, prefix?: string, seen?: Set<string>): string[];
/**
 * Collect property paths from a JSON value (actual response body).
 */
declare function collectPathsFromValue(value: unknown, prefix?: string): string[];

interface PrintReportOptions {
    verbose?: boolean;
    maxMissingItems?: number;
}
declare function printReport(coverage: CoverageResult, opts?: PrintReportOptions): void;
interface PrintConformanceReportOptions {
    maxItems?: number;
}
declare function printConformanceReport(result: ConformanceResult, comparison: ConformanceComparison, opts?: PrintConformanceReportOptions): void;

declare function writeJsonReport(coverage: CoverageResult, filepath: string): void;
declare function writeConformanceJsonReport(result: ConformanceResult, comparison: ConformanceComparison, filepath: string): void;

declare function writeHtmlReport(coverage: CoverageResult, filepath: string): void;

export { ConformanceComparison, ConformanceResult, CoverageConfig, CoverageResult, MatchResult, OpenAPISpec, type PrintConformanceReportOptions, type PrintReportOptions, RecordedCall, SchemaObject, TclInputs, WalkedSpec, checkConformance, collectPathsFromValue, collectSchemaPaths, compareConformance, compareTemplateSpecificity, computeCoverage, computeTcl, getBasePath, getConfig, matchRequestToSpec, pathTemplateToRegex, printConformanceReport, printReport, resolveSchemaRef, stripBasePath, walkSpec, writeConformanceJsonReport, writeHtmlReport, writeJsonReport };
