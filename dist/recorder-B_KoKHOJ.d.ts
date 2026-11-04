interface RecordedCall {
    method: string;
    pathname: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    requestContentType?: string | null;
    responseStatusCode: number;
    responseContentType?: string | null;
    responseBody?: unknown;
    /**
     * What the handler returned, before a schema-driven serializer shaped it, normalised through
     * JSON (`toJSON` applied, `undefined` dropped). Only an adapter that can see the payload before
     * serialization records it; without it, dropped fields and coerced types are invisible.
     */
    responseRawBody?: unknown;
    /**
     * For an error response whose payload never reached the adapter before serialization: the
     * body the framework sends when no schema applies. Used only to detect dropped fields.
     */
    responseErrorBody?: unknown;
    statusCodeAsserted?: boolean;
}
interface CoverageMetric {
    total: number;
    covered: number;
    missing: string[];
}
interface CoverageResult {
    path: CoverageMetric;
    operation: CoverageMetric;
    statusCode: CoverageMetric;
    parameter: CoverageMetric;
    parameterValue: CoverageMetric;
    inputContentType: CoverageMetric;
    outputContentType: CoverageMetric;
    statusCodeClass: CoverageMetric;
    responseBodyProperties: CoverageMetric;
    responseAsserted: CoverageMetric;
    tcl: number;
}
interface CoverageConfig {
    excludedPaths?: string[];
    excludedResponseBodyProperties?: string[];
    excludedStatusCodes?: string[];
}
/**
 * - `schema`: the body breaks the response schema (checked before serialization when possible)
 * - `dropped`: a field the handler returned never reached the client
 * - `status`: the status code is not documented for the operation
 */
type ConformanceKind = 'schema' | 'dropped' | 'status';
interface ConformanceViolation {
    /**
     * Stable identity, used for baselines and allow-lists:
     * `GET /items/{id} 200 dropped items[].secret`, `GET /items/{id} 200 schema:type items[].price`,
     * `GET /items/{id} 409 status`.
     */
    key: string;
    kind: ConformanceKind;
    method: string;
    path: string;
    statusCode: string;
    /** Property path in coverage notation (`items[].id`); empty for the whole body. */
    location: string;
    /** The JSON Schema keyword that failed, for `schema` violations. */
    keyword?: string;
    /** The first occurrence's message. */
    message: string;
    /** How many recorded calls produced this violation. */
    count: number;
    /** The first request that produced it, for reproducing. */
    example: string;
}
interface ConformanceResult {
    /** Recorded calls that matched a documented operation. */
    checked: number;
    /** One entry per key, sorted by key. */
    violations: ConformanceViolation[];
    /** Response schemas that could not be compiled, and why. Their calls were not validated. */
    skipped: Array<{
        schema: string;
        reason: string;
    }>;
}
interface ConformanceComparison {
    /** Violations neither allowed nor in the baseline: the ones that should fail a run. */
    new: ConformanceViolation[];
    /** Violations recorded in the baseline: known debt. */
    baselined: ConformanceViolation[];
    /** Violations matching an allow-list entry: intended, never reported as stale. */
    allowed: ConformanceViolation[];
    /** Baseline entries that no longer occur, so the baseline can shrink. */
    stale: string[];
}
interface OpenAPISpec {
    openapi?: string;
    paths?: Record<string, PathItem>;
    servers?: Array<{
        url: string;
    }>;
    components?: {
        schemas?: Record<string, SchemaObject>;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
interface PathItem {
    get?: OperationObject;
    post?: OperationObject;
    put?: OperationObject;
    patch?: OperationObject;
    delete?: OperationObject;
    head?: OperationObject;
    options?: OperationObject;
    parameters?: ParameterObject[];
    [key: string]: unknown;
}
interface OperationObject {
    parameters?: ParameterObject[];
    requestBody?: {
        content?: Record<string, MediaTypeObject>;
        [key: string]: unknown;
    };
    responses?: Record<string, ResponseObject>;
    [key: string]: unknown;
}
interface ParameterObject {
    name: string;
    in: string;
    schema?: SchemaObject;
    [key: string]: unknown;
}
interface ResponseObject {
    content?: Record<string, MediaTypeObject>;
    [key: string]: unknown;
}
interface MediaTypeObject {
    schema?: SchemaObject;
    [key: string]: unknown;
}
interface SchemaObject {
    type?: string;
    properties?: Record<string, SchemaObject>;
    items?: SchemaObject;
    enum?: unknown[];
    $ref?: string;
    allOf?: SchemaObject[];
    oneOf?: SchemaObject[];
    anyOf?: SchemaObject[];
    [key: string]: unknown;
}
interface SpecOperation {
    path: string;
    method: string;
}
interface SpecStatusCode {
    path: string;
    method: string;
    statusCode: string;
}
interface SpecParameter {
    path: string;
    method: string;
    paramName: string;
    in: string;
}
interface SpecParameterValue {
    path: string;
    method: string;
    paramName: string;
    in: string;
    value: string;
}
interface SpecContentType {
    path: string;
    method: string;
    contentType: string;
}
interface SpecStatusCodeClass {
    path: string;
    method: string;
    class: string;
}
interface SpecResponseBodyProperty {
    path: string;
    method: string;
    statusCode: string;
    contentType: string;
    propertyPath: string;
}
interface WalkedSpec {
    paths: string[];
    operations: SpecOperation[];
    responseStatusCodes: SpecStatusCode[];
    parameters: SpecParameter[];
    parameterValues: SpecParameterValue[];
    inputContentTypes: SpecContentType[];
    outputContentTypes: SpecContentType[];
    statusCodeClasses: SpecStatusCodeClass[];
    responseBodyProperties: SpecResponseBodyProperty[];
}
interface MatchResult {
    pathKey: string;
    method: string;
    pathParams: Record<string, string>;
}
interface TclInputs {
    pathCovered: number;
    pathTotal: number;
    operationCovered: number;
    operationTotal: number;
    inputContentTypeCovered: number;
    inputContentTypeTotal: number;
    outputContentTypeCovered: number;
    outputContentTypeTotal: number;
    parameterCovered: number;
    parameterTotal: number;
    statusCodeClassCovered: number;
    statusCodeClassTotal: number;
    statusCodeCovered: number;
    statusCodeTotal: number;
    parameterValueCovered: number;
    parameterValueTotal: number;
    responseBodyPropertiesCovered: number;
    responseBodyPropertiesTotal: number;
}

declare class Recorder {
    private _calls;
    record(opts: Omit<RecordedCall, 'statusCodeAsserted'>): void;
    markLastResponseAsserted(): void;
    getCalls(): RecordedCall[];
    clear(): void;
}
declare function isOperationKey(key: string): boolean;

export { type CoverageConfig as C, type MatchResult as M, type OpenAPISpec as O, type ParameterObject as P, type RecordedCall as R, type SchemaObject as S, type TclInputs as T, type WalkedSpec as W, type CoverageResult as a, type ConformanceResult as b, type ConformanceComparison as c, type ConformanceKind as d, type ConformanceViolation as e, type CoverageMetric as f, type MediaTypeObject as g, type OperationObject as h, type PathItem as i, Recorder as j, type ResponseObject as k, type SpecContentType as l, type SpecOperation as m, type SpecParameter as n, type SpecParameterValue as o, type SpecResponseBodyProperty as p, type SpecStatusCode as q, type SpecStatusCodeClass as r, isOperationKey as s };
