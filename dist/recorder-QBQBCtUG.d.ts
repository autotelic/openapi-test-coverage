interface RecordedCall {
    method: string;
    pathname: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    requestContentType?: string | null;
    responseStatusCode: number;
    responseContentType?: string | null;
    responseBody?: unknown;
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

export { type CoverageConfig as C, type MatchResult as M, type OpenAPISpec as O, type ParameterObject as P, type RecordedCall as R, type SchemaObject as S, type TclInputs as T, type WalkedSpec as W, type CoverageResult as a, type CoverageMetric as b, type MediaTypeObject as c, type OperationObject as d, type PathItem as e, Recorder as f, type ResponseObject as g, type SpecContentType as h, type SpecOperation as i, type SpecParameter as j, type SpecParameterValue as k, type SpecResponseBodyProperty as l, type SpecStatusCode as m, type SpecStatusCodeClass as n, isOperationKey as o };
