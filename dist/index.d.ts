import { R as RecordedCall, O as OpenAPISpec, C as CoverageConfig, a as CoverageResult, T as TclInputs, W as WalkedSpec, M as MatchResult, S as SchemaObject } from './recorder-QBQBCtUG.js';
export { b as CoverageMetric, c as MediaTypeObject, d as OperationObject, P as ParameterObject, e as PathItem, f as Recorder, g as ResponseObject, h as SpecContentType, i as SpecOperation, j as SpecParameter, k as SpecParameterValue, l as SpecResponseBodyProperty, m as SpecStatusCode, n as SpecStatusCodeClass, o as isOperationKey } from './recorder-QBQBCtUG.js';

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

declare function stripBasePath(pathname: string, basePath: string): string;
declare function pathTemplateToRegex(pathTemplate: string): {
    regex: RegExp;
    paramNames: string[];
};
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

declare function writeJsonReport(coverage: CoverageResult, filepath: string): void;

declare function writeHtmlReport(coverage: CoverageResult, filepath: string): void;

export { CoverageConfig, CoverageResult, MatchResult, OpenAPISpec, type PrintReportOptions, RecordedCall, SchemaObject, TclInputs, WalkedSpec, collectPathsFromValue, collectSchemaPaths, computeCoverage, computeTcl, getBasePath, getConfig, matchRequestToSpec, pathTemplateToRegex, printReport, resolveSchemaRef, stripBasePath, walkSpec, writeHtmlReport, writeJsonReport };
