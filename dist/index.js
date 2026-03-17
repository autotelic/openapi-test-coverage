// src/recorder.ts
var HTTP_METHODS = /* @__PURE__ */ new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
var Recorder = class {
  _calls = [];
  record(opts) {
    this._calls.push({
      method: (opts.method || "").toUpperCase(),
      pathname: opts.pathname || "",
      pathParams: opts.pathParams || {},
      queryParams: opts.queryParams || {},
      requestContentType: opts.requestContentType ?? null,
      responseStatusCode: opts.responseStatusCode,
      responseContentType: opts.responseContentType ?? null,
      responseBody: opts.responseBody !== void 0 ? opts.responseBody : null,
      statusCodeAsserted: false
    });
  }
  markLastResponseAsserted() {
    if (this._calls.length > 0) {
      this._calls[this._calls.length - 1].statusCodeAsserted = true;
    }
  }
  getCalls() {
    return this._calls;
  }
  clear() {
    this._calls = [];
  }
};
function isOperationKey(key) {
  return HTTP_METHODS.has(key.toLowerCase());
}

// src/schema-utils.ts
function resolveSchemaRef(spec, schema) {
  if (!schema || typeof schema !== "object") return null;
  if (schema.$ref) {
    const ref = schema.$ref;
    if (typeof ref !== "string") return null;
    const parts = ref.replace(/^#\//, "").split("/");
    let cur = spec;
    for (const p of parts) {
      cur = cur?.[p];
    }
    return cur || null;
  }
  return schema;
}
function collectSchemaPaths(spec, schema, prefix = "", seen = /* @__PURE__ */ new Set()) {
  const resolved = resolveSchemaRef(spec, schema);
  if (!resolved) return [];
  if (resolved.$ref) {
    const refId = resolved.$ref;
    if (seen.has(refId)) return [];
    seen.add(refId);
    const out = collectSchemaPaths(spec, resolved, prefix, seen);
    seen.delete(refId);
    return out;
  }
  const paths = [];
  if (resolved.type === "object" && resolved.properties && typeof resolved.properties === "object") {
    for (const [key, subSchema] of Object.entries(resolved.properties)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      paths.push(fullPath);
      paths.push(...collectSchemaPaths(spec, subSchema, fullPath, seen));
    }
    return paths;
  }
  if (resolved.type === "array" && resolved.items) {
    const arrayPrefix = prefix ? `${prefix}[]` : "[]";
    paths.push(arrayPrefix);
    const childPrefix = arrayPrefix + ".";
    paths.push(...collectSchemaPaths(spec, resolved.items, childPrefix, seen));
    return paths;
  }
  return paths;
}
function collectPathsFromValue(value, prefix = "") {
  if (value === null || value === void 0) return [];
  const paths = [];
  if (Array.isArray(value)) {
    const arrayPrefix = prefix ? `${prefix}[]` : "[]";
    paths.push(arrayPrefix);
    const childPrefix = arrayPrefix + ".";
    for (let i = 0; i < value.length; i++) {
      paths.push(...collectPathsFromValue(value[i], childPrefix));
    }
    return paths;
  }
  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      paths.push(fullPath);
      paths.push(...collectPathsFromValue(val, fullPath));
    }
    return paths;
  }
  return [];
}

// src/spec-walker.ts
function getParameterValues(param) {
  const schema = param?.schema;
  if (!schema) return [];
  if (Array.isArray(schema.enum)) return schema.enum.map(String);
  if (schema.type === "boolean") return ["true", "false"];
  return [];
}
function walkSpec(spec, excludedPaths = []) {
  const excludeSet = new Set(excludedPaths);
  const result = {
    paths: [],
    operations: [],
    responseStatusCodes: [],
    parameters: [],
    parameterValues: [],
    inputContentTypes: [],
    outputContentTypes: [],
    statusCodeClasses: [],
    responseBodyProperties: []
  };
  const pathEntries = spec.paths ? Object.entries(spec.paths) : [];
  for (const [pathKey, pathItem] of pathEntries) {
    if (excludeSet.has(pathKey)) continue;
    if (!pathItem || typeof pathItem !== "object") continue;
    result.paths.push(pathKey);
    for (const [key, value] of Object.entries(pathItem)) {
      if (!isOperationKey(key)) continue;
      const method = key.toUpperCase();
      const operationObj = value;
      result.operations.push({ path: pathKey, method });
      const responses = operationObj?.responses ?? {};
      const seenOutputContent = /* @__PURE__ */ new Set();
      for (const statusCode of Object.keys(responses)) {
        result.responseStatusCodes.push({ path: pathKey, method, statusCode });
        const responseObj = responses[statusCode];
        const content = responseObj?.content ?? {};
        for (const contentType of Object.keys(content)) {
          const ctKey = `${pathKey}	${method}	${contentType}`;
          if (!seenOutputContent.has(ctKey)) {
            seenOutputContent.add(ctKey);
            result.outputContentTypes.push({ path: pathKey, method, contentType });
          }
          const schema = content[contentType]?.schema;
          if (schema) {
            const propPaths = collectSchemaPaths(spec, schema);
            for (const propPath of propPaths) {
              result.responseBodyProperties.push({ path: pathKey, method, statusCode, contentType, propertyPath: propPath });
            }
          }
        }
      }
      const params = operationObj?.parameters ?? [];
      for (const p of params) {
        if (p?.name && p?.in) {
          result.parameters.push({ path: pathKey, method, paramName: p.name, in: p.in });
          if (p.in !== "body") {
            const values = getParameterValues(p);
            for (const value2 of values) {
              result.parameterValues.push({ path: pathKey, method, paramName: p.name, in: p.in, value: String(value2) });
            }
          }
        }
      }
      const requestBody = operationObj?.requestBody;
      const bodyContent = requestBody?.content ?? {};
      for (const contentType of Object.keys(bodyContent)) {
        result.inputContentTypes.push({ path: pathKey, method, contentType });
        result.parameters.push({ path: pathKey, method, paramName: contentType, in: "body" });
      }
      const hasSuccess = Object.keys(responses).some((sc) => sc.startsWith("2"));
      const hasError = Object.keys(responses).some((sc) => sc.startsWith("4") || sc.startsWith("5"));
      if (hasSuccess) result.statusCodeClasses.push({ path: pathKey, method, class: "2xx" });
      if (hasError) result.statusCodeClasses.push({ path: pathKey, method, class: "4xx/5xx" });
    }
  }
  return result;
}

// src/matcher.ts
function stripBasePath(pathname, basePath) {
  if (!basePath) return pathname || "/";
  const p = pathname || "/";
  if (p === basePath) return "/";
  if (basePath.length > 0 && p.startsWith(basePath + "/")) {
    return "/" + p.slice(basePath.length + 1);
  }
  if (p.startsWith(basePath)) {
    return p.slice(basePath.length) || "/";
  }
  return p;
}
function pathTemplateToRegex(pathTemplate) {
  const paramNames = [];
  const pattern = pathTemplate.replace(/\{([^}]+)\}/g, (_, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  const regex = new RegExp("^" + pattern + "$");
  return { regex, paramNames };
}
function matchRequestToSpec(recordedCall, specPathKeys, basePath) {
  const method = (recordedCall.method || "").toUpperCase();
  const rawPath = (recordedCall.pathname || "").replace(/\/+$/, "") || "/";
  const pathname = stripBasePath(rawPath, basePath);
  const sortedPaths = [...specPathKeys].sort((a, b) => b.length - a.length);
  for (const pathKey of sortedPaths) {
    const { regex, paramNames } = pathTemplateToRegex(pathKey);
    const match = pathname.match(regex);
    if (match) {
      const pathParams = {};
      paramNames.forEach((name, i) => {
        pathParams[name] = match[i + 1];
      });
      return { pathKey, method, pathParams };
    }
  }
  return null;
}

// src/config.ts
function getBasePath(spec) {
  if (!spec.servers || spec.servers.length === 0) return "";
  const url = spec.servers[0].url;
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;
  } catch {
    return "";
  }
}
function getConfig(spec, excludedPaths = [], excludedResponseBodyProperties = [], excludedStatusCodes = []) {
  return {
    basePath: getBasePath(spec),
    excludedPaths: Array.isArray(excludedPaths) ? excludedPaths : [],
    excludedResponseBodyProperties: Array.isArray(excludedResponseBodyProperties) ? excludedResponseBodyProperties : [],
    excludedStatusCodes: Array.isArray(excludedStatusCodes) ? excludedStatusCodes : []
  };
}

// src/coverage.ts
function statusCodeToClass(statusCode) {
  const n = Number(statusCode);
  if (n >= 200 && n < 300) return "2xx";
  if (n >= 400 && n < 600) return "4xx/5xx";
  return null;
}
function computeCoverage(recordedCalls, spec, config = {}) {
  const { basePath, excludedPaths, excludedResponseBodyProperties, excludedStatusCodes } = getConfig(
    spec,
    config.excludedPaths,
    config.excludedResponseBodyProperties,
    config.excludedStatusCodes
  );
  const walked = walkSpec(spec, excludedPaths);
  let {
    paths: specPaths,
    operations: specOperations,
    responseStatusCodes: specStatusCodes,
    parameters: specParameters,
    parameterValues: specParameterValues,
    inputContentTypes: specInputContentTypes,
    outputContentTypes: specOutputContentTypes,
    statusCodeClasses: specStatusCodeClasses,
    responseBodyProperties: specResponseBodyProperties
  } = walked;
  const excludedStatusCodeSet = new Set(excludedStatusCodes || []);
  if (excludedStatusCodeSet.size > 0) {
    const statusCodeKey = (r) => `${r.path}	${r.method}	${r.statusCode}`;
    specStatusCodes = specStatusCodes.filter((r) => !excludedStatusCodeSet.has(statusCodeKey(r)));
    specResponseBodyProperties = specResponseBodyProperties.filter(
      (r) => !excludedStatusCodeSet.has(`${r.path}	${r.method}	${r.statusCode}`)
    );
  }
  const excludedBodyPropSet = new Set(excludedResponseBodyProperties || []);
  if (excludedBodyPropSet.size > 0) {
    const responseBodyPropKey2 = (r) => `${r.path}	${r.method}	${r.statusCode}	${(r.contentType || "").toLowerCase()}	${r.propertyPath}`;
    specResponseBodyProperties = specResponseBodyProperties.filter((r) => !excludedBodyPropSet.has(responseBodyPropKey2(r)));
  }
  const pathKeysSet = new Set(specPaths);
  const specStatusCodeKeySet = new Set(specStatusCodes.map((r) => `${r.path}	${r.method}	${r.statusCode}`));
  const coveredPaths = /* @__PURE__ */ new Set();
  const coveredOperations = /* @__PURE__ */ new Set();
  const coveredStatusCodes = /* @__PURE__ */ new Set();
  const coveredParameters = /* @__PURE__ */ new Set();
  const coveredParameterValues = /* @__PURE__ */ new Set();
  const coveredInputContentTypes = /* @__PURE__ */ new Set();
  const coveredOutputContentTypes = /* @__PURE__ */ new Set();
  const coveredStatusCodeClasses = /* @__PURE__ */ new Set();
  const coveredResponseBodyProperties = /* @__PURE__ */ new Set();
  const coveredResponseAsserted = /* @__PURE__ */ new Set();
  for (const call of recordedCalls) {
    const matched = matchRequestToSpec(call, specPaths, basePath);
    if (!matched) continue;
    const { pathKey, method, pathParams } = matched;
    if (pathKeysSet.has(pathKey)) {
      coveredPaths.add(pathKey);
    }
    coveredOperations.add(`${pathKey}	${method}`);
    const statusCodeKey = `${pathKey}	${method}	${call.responseStatusCode}`;
    if (specStatusCodeKeySet.has(statusCodeKey)) {
      coveredStatusCodes.add(statusCodeKey);
    }
    const opKey = `${pathKey}	${method}`;
    for (const [name, val] of Object.entries(pathParams || {})) {
      coveredParameters.add(`${opKey}	${name}	path`);
      coveredParameterValues.add(`${opKey}	${name}	path	${String(val)}`);
    }
    for (const [name, val] of Object.entries(call.queryParams || {})) {
      coveredParameters.add(`${opKey}	${name}	query`);
      coveredParameterValues.add(`${opKey}	${name}	query	${String(val)}`);
    }
    if (call.requestContentType) {
      const ct = call.requestContentType.split(";")[0].trim().toLowerCase();
      coveredParameters.add(`${opKey}	${ct}	body`);
      coveredInputContentTypes.add(`${opKey}	${ct}`);
    }
    if (call.responseContentType) {
      const ct = call.responseContentType.split(";")[0].trim().toLowerCase();
      coveredOutputContentTypes.add(`${opKey}	${ct}`);
    }
    const cls = statusCodeToClass(call.responseStatusCode);
    if (cls) {
      coveredStatusCodeClasses.add(`${opKey}	${cls}`);
    }
    if (call.responseBody != null && call.responseContentType) {
      const statusStr = String(call.responseStatusCode);
      const ct = call.responseContentType.split(";")[0].trim().toLowerCase();
      const bodyPaths = collectPathsFromValue(call.responseBody);
      for (const propPath of bodyPaths) {
        coveredResponseBodyProperties.add(`${pathKey}	${method}	${statusStr}	${ct}	${propPath}`);
      }
    }
    if (call.statusCodeAsserted) {
      coveredResponseAsserted.add(`${pathKey}	${method}	${call.responseStatusCode}`);
    }
  }
  const parameterKey = (p) => {
    const name = p.in === "body" ? (p.paramName || "").toLowerCase() : p.paramName || "";
    return `${p.path}	${p.method}	${name}	${p.in}`;
  };
  const ctKey = (path3, method, contentType) => `${path3}	${method}	${(contentType || "").toLowerCase()}`;
  const paramTotal = specParameters.length;
  const paramCovered = specParameters.filter((p) => coveredParameters.has(parameterKey(p))).length;
  const paramMissing = specParameters.filter((p) => !coveredParameters.has(parameterKey(p))).map((p) => `${p.method} ${p.path} ${p.in}:${p.paramName}`);
  const inputCtTotal = specInputContentTypes.length;
  const inputCtCovered = specInputContentTypes.filter((x) => coveredInputContentTypes.has(ctKey(x.path, x.method, x.contentType))).length;
  const inputCtMissing = specInputContentTypes.filter((x) => !coveredInputContentTypes.has(ctKey(x.path, x.method, x.contentType))).map((x) => `${x.method} ${x.path} request ${x.contentType}`);
  const outputCtTotal = specOutputContentTypes.length;
  const outputCtCovered = specOutputContentTypes.filter((x) => coveredOutputContentTypes.has(ctKey(x.path, x.method, x.contentType))).length;
  const outputCtMissing = specOutputContentTypes.filter((x) => !coveredOutputContentTypes.has(ctKey(x.path, x.method, x.contentType))).map((x) => `${x.method} ${x.path} response ${x.contentType}`);
  const statusClassTotal = specStatusCodeClasses.length;
  const statusClassCovered = specStatusCodeClasses.filter((x) => coveredStatusCodeClasses.has(`${x.path}	${x.method}	${x.class}`)).length;
  const statusClassMissing = specStatusCodeClasses.filter((x) => !coveredStatusCodeClasses.has(`${x.path}	${x.method}	${x.class}`)).map((x) => `${x.method} ${x.path} ${x.class}`);
  const paramValueKey = (v) => `${v.path}	${v.method}	${v.paramName}	${v.in}	${String(v.value)}`;
  const paramValueTotal = specParameterValues.length;
  const paramValueCovered = specParameterValues.filter((v) => coveredParameterValues.has(paramValueKey(v))).length;
  const paramValueMissing = specParameterValues.filter((v) => !coveredParameterValues.has(paramValueKey(v))).map((v) => `${v.method} ${v.path} ${v.in}:${v.paramName}=${v.value}`);
  const responseBodyPropKey = (r) => `${r.path}	${r.method}	${r.statusCode}	${(r.contentType || "").toLowerCase()}	${r.propertyPath}`;
  const responseBodyPropTotal = specResponseBodyProperties.length;
  const responseBodyPropCovered = specResponseBodyProperties.filter((r) => coveredResponseBodyProperties.has(responseBodyPropKey(r))).length;
  const responseBodyPropMissing = specResponseBodyProperties.filter((r) => !coveredResponseBodyProperties.has(responseBodyPropKey(r))).map((r) => `${r.method} ${r.path} ${r.statusCode} ${r.contentType} ${r.propertyPath}`);
  const responseAssertedKey = (r) => `${r.path}	${r.method}	${r.statusCode}`;
  const responseAssertedTotal = specStatusCodes.length;
  const responseAssertedCovered = specStatusCodes.filter((r) => coveredResponseAsserted.has(responseAssertedKey(r))).length;
  const responseAssertedMissing = specStatusCodes.filter((r) => !coveredResponseAsserted.has(responseAssertedKey(r))).map((r) => `${r.method} ${r.path} ${r.statusCode}`);
  const statusCodeTotal = specStatusCodes.length;
  const statusCodeCovered = coveredStatusCodes.size;
  return {
    path: {
      total: specPaths.length,
      covered: coveredPaths.size,
      missing: specPaths.filter((p) => !coveredPaths.has(p))
    },
    operation: {
      total: specOperations.length,
      covered: coveredOperations.size,
      missing: specOperations.filter(({ path: path3, method }) => !coveredOperations.has(`${path3}	${method}`)).map(({ path: path3, method }) => `${method} ${path3}`)
    },
    statusCode: {
      total: statusCodeTotal,
      covered: statusCodeCovered,
      missing: specStatusCodes.filter(({ path: path3, method, statusCode }) => !coveredStatusCodes.has(`${path3}	${method}	${statusCode}`)).map(({ path: path3, method, statusCode }) => `${method} ${path3} ${statusCode}`)
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
      responseBodyPropertiesTotal: responseBodyPropTotal
    })
  };
}
function computeTcl(c) {
  if (c.pathTotal === 0) return 0;
  if (c.pathCovered < c.pathTotal) return 0;
  if (c.operationTotal === 0) return 1;
  if (c.operationCovered < c.operationTotal) return 1;
  if (c.inputContentTypeTotal > 0 && c.inputContentTypeCovered < c.inputContentTypeTotal) return 2;
  if (c.outputContentTypeTotal > 0 && c.outputContentTypeCovered < c.outputContentTypeTotal) return 2;
  if (c.parameterTotal > 0 && c.parameterCovered < c.parameterTotal) return 3;
  if (c.statusCodeClassTotal > 0 && c.statusCodeClassCovered < c.statusCodeClassTotal) return 3;
  if (c.parameterValueTotal > 0 && c.parameterValueCovered < c.parameterValueTotal) return 4;
  if (c.statusCodeTotal > 0 && c.statusCodeCovered < c.statusCodeTotal) return 4;
  if (c.responseBodyPropertiesTotal > 0 && c.responseBodyPropertiesCovered < c.responseBodyPropertiesTotal) return 5;
  return 6;
}

// src/reporters/console.ts
import { bold, cyan, green, yellow, red, dim, gray } from "colorette";
function ratioColour(covered, total) {
  if (total === 0) return gray("0/0");
  const pct = covered / total * 100;
  const str = `${covered}/${total}`;
  if (pct >= 100) return green(str);
  if (pct >= 50) return yellow(str);
  return red(str);
}
function printReport(coverage, opts = {}) {
  const { verbose = false, maxMissingItems = 15 } = opts;
  const tclLabel = "0=none, 1=paths, 2=+operations, 3=+content-types, 4=+params+statusClass, 5=+param values+statusCodes, 6=+response body props";
  const tclStr = coverage.tcl >= 4 ? green(String(coverage.tcl)) : coverage.tcl >= 1 ? yellow(String(coverage.tcl)) : red(String(coverage.tcl));
  console.log();
  console.log(bold(cyan("--- OpenAPI coverage ---")));
  console.log(bold("TCL:"), tclStr, dim(`(${tclLabel})`));
  console.log(dim("  Paths:               "), ratioColour(coverage.path.covered, coverage.path.total));
  console.log(dim("  Operations:          "), ratioColour(coverage.operation.covered, coverage.operation.total));
  console.log(dim("  Status codes:        "), ratioColour(coverage.statusCode.covered, coverage.statusCode.total));
  console.log(dim("  Parameters:          "), ratioColour(coverage.parameter.covered, coverage.parameter.total));
  console.log(dim("  Parameter values:    "), ratioColour(coverage.parameterValue.covered, coverage.parameterValue.total));
  console.log(dim("  Response body props:  "), ratioColour(coverage.responseBodyProperties.covered, coverage.responseBodyProperties.total));
  console.log(dim("  Response asserted:    "), ratioColour(coverage.responseAsserted.covered, coverage.responseAsserted.total));
  console.log(dim("  Input content-type:   "), ratioColour(coverage.inputContentType.covered, coverage.inputContentType.total));
  console.log(dim("  Output content-type: "), ratioColour(coverage.outputContentType.covered, coverage.outputContentType.total));
  console.log(dim("  Status code class:   "), ratioColour(coverage.statusCodeClass.covered, coverage.statusCodeClass.total));
  console.log(dim("-------------------------------------------"));
  console.log();
  if (verbose) {
    const showMissing = (label, metric) => {
      if (metric.missing.length === 0) return;
      console.log(bold(yellow(label)));
      metric.missing.slice(0, maxMissingItems).forEach((item) => console.log(dim("  ") + gray(item)));
      if (metric.missing.length > maxMissingItems) {
        console.log(dim(`  ... and ${metric.missing.length - maxMissingItems} more`));
      }
      console.log();
    };
    showMissing("Missing paths:", coverage.path);
    showMissing("Missing operations:", coverage.operation);
    showMissing("Missing status codes:", coverage.statusCode);
    showMissing("Missing parameters:", coverage.parameter);
    showMissing("Missing parameter values:", coverage.parameterValue);
    showMissing("Missing response body properties:", coverage.responseBodyProperties);
    showMissing("Missing response asserted:", coverage.responseAsserted);
    showMissing("Missing input content-types:", coverage.inputContentType);
    showMissing("Missing output content-types:", coverage.outputContentType);
    showMissing("Missing status code classes:", coverage.statusCodeClass);
  }
}

// src/reporters/json.ts
import fs from "fs";
import path from "path";
function writeJsonReport(coverage, filepath) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(coverage, null, 2), "utf8");
}

// src/reporters/html.ts
import fs2 from "fs";
import path2 from "path";
function writeHtmlReport(coverage, filepath) {
  const dir = path2.dirname(filepath);
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
  const row = (label, metric) => {
    const pct = metric.total ? (metric.covered / metric.total * 100).toFixed(1) : "0";
    const cls = metric.total === 0 ? "dim" : Number(pct) >= 100 ? "ok" : Number(pct) >= 50 ? "warn" : "fail";
    return `<tr><td>${label}</td><td class="${cls}">${metric.covered}/${metric.total}</td><td class="${cls}">${pct}%</td></tr>`;
  };
  const rows = [
    row("Paths", coverage.path),
    row("Operations", coverage.operation),
    row("Status codes", coverage.statusCode),
    row("Parameters", coverage.parameter),
    row("Parameter values", coverage.parameterValue),
    row("Response body props", coverage.responseBodyProperties),
    row("Response asserted", coverage.responseAsserted),
    row("Input content-type", coverage.inputContentType),
    row("Output content-type", coverage.outputContentType),
    row("Status code class", coverage.statusCodeClass)
  ].join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>OpenAPI coverage</title>
<style>
  body { font-family: system-ui,sans-serif; margin: 1rem 2rem; }
  h1 { color: #0e7490; }
  table { border-collapse: collapse; }
  th, td { text-align: left; padding: 0.25rem 0.75rem; border: 1px solid #e5e7eb; }
  .ok { color: #059669; }
  .warn { color: #d97706; }
  .fail { color: #dc2626; }
  .dim { color: #9ca3af; }
  .tcl { font-size: 1.25rem; margin: 0.5rem 0; }
</style>
</head>
<body>
  <h1>OpenAPI coverage</h1>
  <p class="tcl"><strong>TCL:</strong> ${coverage.tcl} <span class="dim">(0=none ... 6=full)</span></p>
  <table>
    <thead><tr><th>Criterion</th><th>Covered</th><th>%</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
  fs2.writeFileSync(filepath, html, "utf8");
}
export {
  Recorder,
  collectPathsFromValue,
  collectSchemaPaths,
  computeCoverage,
  computeTcl,
  getBasePath,
  getConfig,
  isOperationKey,
  matchRequestToSpec,
  pathTemplateToRegex,
  printReport,
  resolveSchemaRef,
  stripBasePath,
  walkSpec,
  writeHtmlReport,
  writeJsonReport
};
//# sourceMappingURL=index.js.map