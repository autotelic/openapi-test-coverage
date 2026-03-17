import type {
  OpenAPISpec,
  ParameterObject,
  WalkedSpec,
} from './types.js'
import { isOperationKey } from './recorder.js'
import { collectSchemaPaths } from './schema-utils.js'

function getParameterValues(param: ParameterObject): string[] {
  const schema = param?.schema
  if (!schema) return []
  if (Array.isArray(schema.enum)) return schema.enum.map(String)
  if (schema.type === 'boolean') return ['true', 'false']
  return []
}

/**
 * Walk a resolved OpenAPI spec and extract all coverage targets:
 * paths, operations, status codes, parameters, parameter values,
 * input/output content-types, status code classes, and response body properties.
 */
export function walkSpec(spec: OpenAPISpec, excludedPaths: string[] = []): WalkedSpec {
  const excludeSet = new Set(excludedPaths)
  const result: WalkedSpec = {
    paths: [],
    operations: [],
    responseStatusCodes: [],
    parameters: [],
    parameterValues: [],
    inputContentTypes: [],
    outputContentTypes: [],
    statusCodeClasses: [],
    responseBodyProperties: [],
  }

  const pathEntries = spec.paths ? Object.entries(spec.paths) : []
  for (const [pathKey, pathItem] of pathEntries) {
    if (excludeSet.has(pathKey)) continue
    if (!pathItem || typeof pathItem !== 'object') continue

    result.paths.push(pathKey)

    for (const [key, value] of Object.entries(pathItem)) {
      if (!isOperationKey(key)) continue
      const method = key.toUpperCase()
      const operationObj = value as Record<string, unknown>
      result.operations.push({ path: pathKey, method })

      const responses = (operationObj?.responses ?? {}) as Record<string, Record<string, unknown>>
      const seenOutputContent = new Set<string>()
      for (const statusCode of Object.keys(responses)) {
        result.responseStatusCodes.push({ path: pathKey, method, statusCode })
        const responseObj = responses[statusCode]
        const content = (responseObj?.content ?? {}) as Record<string, Record<string, unknown>>
        for (const contentType of Object.keys(content)) {
          const ctKey = `${pathKey}\t${method}\t${contentType}`
          if (!seenOutputContent.has(ctKey)) {
            seenOutputContent.add(ctKey)
            result.outputContentTypes.push({ path: pathKey, method, contentType })
          }
          const schema = content[contentType]?.schema
          if (schema) {
            const propPaths = collectSchemaPaths(spec, schema as Record<string, unknown>)
            for (const propPath of propPaths) {
              result.responseBodyProperties.push({ path: pathKey, method, statusCode, contentType, propertyPath: propPath })
            }
          }
        }
      }

      const params = (operationObj?.parameters ?? []) as ParameterObject[]
      for (const p of params) {
        if (p?.name && p?.in) {
          result.parameters.push({ path: pathKey, method, paramName: p.name, in: p.in })
          if (p.in !== 'body') {
            const values = getParameterValues(p)
            for (const value of values) {
              result.parameterValues.push({ path: pathKey, method, paramName: p.name, in: p.in, value: String(value) })
            }
          }
        }
      }

      const requestBody = operationObj?.requestBody as Record<string, unknown> | undefined
      const bodyContent = (requestBody?.content ?? {}) as Record<string, unknown>
      for (const contentType of Object.keys(bodyContent)) {
        result.inputContentTypes.push({ path: pathKey, method, contentType })
        result.parameters.push({ path: pathKey, method, paramName: contentType, in: 'body' })
      }

      const hasSuccess = Object.keys(responses).some(sc => sc.startsWith('2'))
      const hasError = Object.keys(responses).some(sc => sc.startsWith('4') || sc.startsWith('5'))
      if (hasSuccess) result.statusCodeClasses.push({ path: pathKey, method, class: '2xx' })
      if (hasError) result.statusCodeClasses.push({ path: pathKey, method, class: '4xx/5xx' })
    }
  }

  return result
}
