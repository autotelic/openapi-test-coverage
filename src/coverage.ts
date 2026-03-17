import type {
  RecordedCall,
  OpenAPISpec,
  CoverageConfig,
  CoverageResult,
  TclInputs,
  SpecParameter,
  SpecResponseBodyProperty,
} from './types.js'
import { walkSpec } from './spec-walker.js'
import { matchRequestToSpec } from './matcher.js'
import { getConfig } from './config.js'
import { collectPathsFromValue } from './schema-utils.js'

function statusCodeToClass(statusCode: number | string): string | null {
  const n = Number(statusCode)
  if (n >= 200 && n < 300) return '2xx'
  if (n >= 400 && n < 600) return '4xx/5xx'
  return null
}

export function computeCoverage(
  recordedCalls: RecordedCall[],
  spec: OpenAPISpec,
  config: CoverageConfig = {},
): CoverageResult {
  const { basePath, excludedPaths, excludedResponseBodyProperties, excludedStatusCodes } = getConfig(
    spec,
    config.excludedPaths,
    config.excludedResponseBodyProperties,
    config.excludedStatusCodes,
  )

  const walked = walkSpec(spec, excludedPaths)
  let {
    paths: specPaths,
    operations: specOperations,
    responseStatusCodes: specStatusCodes,
    parameters: specParameters,
    parameterValues: specParameterValues,
    inputContentTypes: specInputContentTypes,
    outputContentTypes: specOutputContentTypes,
    statusCodeClasses: specStatusCodeClasses,
    responseBodyProperties: specResponseBodyProperties,
  } = walked

  const excludedStatusCodeSet = new Set(excludedStatusCodes || [])
  if (excludedStatusCodeSet.size > 0) {
    const statusCodeKey = (r: { path: string; method: string; statusCode: string }) =>
      `${r.path}\t${r.method}\t${r.statusCode}`
    specStatusCodes = specStatusCodes.filter(r => !excludedStatusCodeSet.has(statusCodeKey(r)))
    specResponseBodyProperties = specResponseBodyProperties.filter(
      r => !excludedStatusCodeSet.has(`${r.path}\t${r.method}\t${r.statusCode}`),
    )
  }

  const excludedBodyPropSet = new Set(excludedResponseBodyProperties || [])
  if (excludedBodyPropSet.size > 0) {
    const responseBodyPropKey = (r: SpecResponseBodyProperty) =>
      `${r.path}\t${r.method}\t${r.statusCode}\t${(r.contentType || '').toLowerCase()}\t${r.propertyPath}`
    specResponseBodyProperties = specResponseBodyProperties.filter(r => !excludedBodyPropSet.has(responseBodyPropKey(r)))
  }

  const pathKeysSet = new Set(specPaths)
  const specStatusCodeKeySet = new Set(specStatusCodes.map(r => `${r.path}\t${r.method}\t${r.statusCode}`))
  const coveredPaths = new Set<string>()
  const coveredOperations = new Set<string>()
  const coveredStatusCodes = new Set<string>()
  const coveredParameters = new Set<string>()
  const coveredParameterValues = new Set<string>()
  const coveredInputContentTypes = new Set<string>()
  const coveredOutputContentTypes = new Set<string>()
  const coveredStatusCodeClasses = new Set<string>()
  const coveredResponseBodyProperties = new Set<string>()
  const coveredResponseAsserted = new Set<string>()

  for (const call of recordedCalls) {
    const matched = matchRequestToSpec(call, specPaths, basePath)
    if (!matched) continue

    const { pathKey, method, pathParams } = matched
    if (pathKeysSet.has(pathKey)) {
      coveredPaths.add(pathKey)
    }
    coveredOperations.add(`${pathKey}\t${method}`)
    const statusCodeKey = `${pathKey}\t${method}\t${call.responseStatusCode}`
    if (specStatusCodeKeySet.has(statusCodeKey)) {
      coveredStatusCodes.add(statusCodeKey)
    }

    const opKey = `${pathKey}\t${method}`

    for (const [name, val] of Object.entries(pathParams || {})) {
      coveredParameters.add(`${opKey}\t${name}\tpath`)
      coveredParameterValues.add(`${opKey}\t${name}\tpath\t${String(val)}`)
    }
    for (const [name, val] of Object.entries(call.queryParams || {})) {
      coveredParameters.add(`${opKey}\t${name}\tquery`)
      coveredParameterValues.add(`${opKey}\t${name}\tquery\t${String(val)}`)
    }
    if (call.requestContentType) {
      const ct = call.requestContentType.split(';')[0].trim().toLowerCase()
      coveredParameters.add(`${opKey}\t${ct}\tbody`)
      coveredInputContentTypes.add(`${opKey}\t${ct}`)
    }

    if (call.responseContentType) {
      const ct = call.responseContentType.split(';')[0].trim().toLowerCase()
      coveredOutputContentTypes.add(`${opKey}\t${ct}`)
    }

    const cls = statusCodeToClass(call.responseStatusCode)
    if (cls) {
      coveredStatusCodeClasses.add(`${opKey}\t${cls}`)
    }

    if (call.responseBody != null && call.responseContentType) {
      const statusStr = String(call.responseStatusCode)
      const ct = call.responseContentType.split(';')[0].trim().toLowerCase()
      const bodyPaths = collectPathsFromValue(call.responseBody)
      for (const propPath of bodyPaths) {
        coveredResponseBodyProperties.add(`${pathKey}\t${method}\t${statusStr}\t${ct}\t${propPath}`)
      }
    }

    if (call.statusCodeAsserted) {
      coveredResponseAsserted.add(`${pathKey}\t${method}\t${call.responseStatusCode}`)
    }
  }

  const parameterKey = (p: SpecParameter) => {
    const name = p.in === 'body' ? (p.paramName || '').toLowerCase() : (p.paramName || '')
    return `${p.path}\t${p.method}\t${name}\t${p.in}`
  }
  const ctKey = (path: string, method: string, contentType: string) =>
    `${path}\t${method}\t${(contentType || '').toLowerCase()}`

  const paramTotal = specParameters.length
  const paramCovered = specParameters.filter(p => coveredParameters.has(parameterKey(p))).length
  const paramMissing = specParameters
    .filter(p => !coveredParameters.has(parameterKey(p)))
    .map(p => `${p.method} ${p.path} ${p.in}:${p.paramName}`)

  const inputCtTotal = specInputContentTypes.length
  const inputCtCovered = specInputContentTypes.filter(x => coveredInputContentTypes.has(ctKey(x.path, x.method, x.contentType))).length
  const inputCtMissing = specInputContentTypes
    .filter(x => !coveredInputContentTypes.has(ctKey(x.path, x.method, x.contentType)))
    .map(x => `${x.method} ${x.path} request ${x.contentType}`)

  const outputCtTotal = specOutputContentTypes.length
  const outputCtCovered = specOutputContentTypes.filter(x => coveredOutputContentTypes.has(ctKey(x.path, x.method, x.contentType))).length
  const outputCtMissing = specOutputContentTypes
    .filter(x => !coveredOutputContentTypes.has(ctKey(x.path, x.method, x.contentType)))
    .map(x => `${x.method} ${x.path} response ${x.contentType}`)

  const statusClassTotal = specStatusCodeClasses.length
  const statusClassCovered = specStatusCodeClasses.filter(x => coveredStatusCodeClasses.has(`${x.path}\t${x.method}\t${x.class}`)).length
  const statusClassMissing = specStatusCodeClasses
    .filter(x => !coveredStatusCodeClasses.has(`${x.path}\t${x.method}\t${x.class}`))
    .map(x => `${x.method} ${x.path} ${x.class}`)

  const paramValueKey = (v: { path: string; method: string; paramName: string; in: string; value: string }) =>
    `${v.path}\t${v.method}\t${v.paramName}\t${v.in}\t${String(v.value)}`
  const paramValueTotal = specParameterValues.length
  const paramValueCovered = specParameterValues.filter(v => coveredParameterValues.has(paramValueKey(v))).length
  const paramValueMissing = specParameterValues
    .filter(v => !coveredParameterValues.has(paramValueKey(v)))
    .map(v => `${v.method} ${v.path} ${v.in}:${v.paramName}=${v.value}`)

  const responseBodyPropKey = (r: SpecResponseBodyProperty) =>
    `${r.path}\t${r.method}\t${r.statusCode}\t${(r.contentType || '').toLowerCase()}\t${r.propertyPath}`
  const responseBodyPropTotal = specResponseBodyProperties.length
  const responseBodyPropCovered = specResponseBodyProperties.filter(r => coveredResponseBodyProperties.has(responseBodyPropKey(r))).length
  const responseBodyPropMissing = specResponseBodyProperties
    .filter(r => !coveredResponseBodyProperties.has(responseBodyPropKey(r)))
    .map(r => `${r.method} ${r.path} ${r.statusCode} ${r.contentType} ${r.propertyPath}`)

  const responseAssertedKey = (r: { path: string; method: string; statusCode: string }) =>
    `${r.path}\t${r.method}\t${r.statusCode}`
  const responseAssertedTotal = specStatusCodes.length
  const responseAssertedCovered = specStatusCodes.filter(r => coveredResponseAsserted.has(responseAssertedKey(r))).length
  const responseAssertedMissing = specStatusCodes
    .filter(r => !coveredResponseAsserted.has(responseAssertedKey(r)))
    .map(r => `${r.method} ${r.path} ${r.statusCode}`)

  const statusCodeTotal = specStatusCodes.length
  const statusCodeCovered = coveredStatusCodes.size

  return {
    path: {
      total: specPaths.length,
      covered: coveredPaths.size,
      missing: specPaths.filter(p => !coveredPaths.has(p)),
    },
    operation: {
      total: specOperations.length,
      covered: coveredOperations.size,
      missing: specOperations
        .filter(({ path, method }) => !coveredOperations.has(`${path}\t${method}`))
        .map(({ path, method }) => `${method} ${path}`),
    },
    statusCode: {
      total: statusCodeTotal,
      covered: statusCodeCovered,
      missing: specStatusCodes
        .filter(({ path, method, statusCode }) => !coveredStatusCodes.has(`${path}\t${method}\t${statusCode}`))
        .map(({ path, method, statusCode }) => `${method} ${path} ${statusCode}`),
    },
    parameter: { total: paramTotal, covered: paramCovered, missing: paramMissing },
    inputContentType: { total: inputCtTotal, covered: inputCtCovered, missing: inputCtMissing },
    outputContentType: { total: outputCtTotal, covered: outputCtCovered, missing: outputCtMissing },
    statusCodeClass: { total: statusClassTotal, covered: statusClassCovered, missing: statusClassMissing },
    parameterValue: { total: paramValueTotal, covered: paramValueCovered, missing: paramValueMissing },
    responseBodyProperties: { total: responseBodyPropTotal, covered: responseBodyPropCovered, missing: responseBodyPropMissing },
    responseAsserted: { total: responseAssertedTotal, covered: responseAssertedCovered, missing: responseAssertedMissing },
    tcl: computeTcl({
      pathCovered: coveredPaths.size,
      pathTotal: specPaths.length,
      operationCovered: coveredOperations.size,
      operationTotal: specOperations.length,
      inputContentTypeCovered: inputCtCovered,
      inputContentTypeTotal: inputCtTotal,
      outputContentTypeCovered: outputCtCovered,
      outputContentTypeTotal: outputCtTotal,
      parameterCovered: paramCovered,
      parameterTotal: paramTotal,
      statusCodeClassCovered: statusClassCovered,
      statusCodeClassTotal: statusClassTotal,
      statusCodeCovered,
      statusCodeTotal,
      parameterValueCovered: paramValueCovered,
      parameterValueTotal: paramValueTotal,
      responseBodyPropertiesCovered: responseBodyPropCovered,
      responseBodyPropertiesTotal: responseBodyPropTotal,
    }),
  }
}

/**
 * TCL 0-6: cumulative coverage levels per A-TEST '19.
 * TCL 1=paths, 2=+operations, 3=+content-types, 4=+params+statusClass,
 * 5=+param values+statusCodes, 6=+response body properties.
 */
export function computeTcl(c: TclInputs): number {
  if (c.pathTotal === 0) return 0
  if (c.pathCovered < c.pathTotal) return 0
  if (c.operationTotal === 0) return 1
  if (c.operationCovered < c.operationTotal) return 1
  if (c.inputContentTypeTotal > 0 && c.inputContentTypeCovered < c.inputContentTypeTotal) return 2
  if (c.outputContentTypeTotal > 0 && c.outputContentTypeCovered < c.outputContentTypeTotal) return 2
  if (c.parameterTotal > 0 && c.parameterCovered < c.parameterTotal) return 3
  if (c.statusCodeClassTotal > 0 && c.statusCodeClassCovered < c.statusCodeClassTotal) return 3
  if (c.parameterValueTotal > 0 && c.parameterValueCovered < c.parameterValueTotal) return 4
  if (c.statusCodeTotal > 0 && c.statusCodeCovered < c.statusCodeTotal) return 4
  if (c.responseBodyPropertiesTotal > 0 && c.responseBodyPropertiesCovered < c.responseBodyPropertiesTotal) return 5
  return 6
}
