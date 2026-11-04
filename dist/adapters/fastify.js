// src/adapters/fastify.ts
import { STATUS_CODES } from "http";

// src/recorder.ts
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
      ...opts.responseRawBody !== void 0 ? { responseRawBody: opts.responseRawBody } : {},
      ...opts.responseErrorBody !== void 0 ? { responseErrorBody: opts.responseErrorBody } : {},
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

// src/adapters/fastify.ts
var RAW_BODY = /* @__PURE__ */ Symbol("openApiCoverageRawBody");
var ERROR_BODY = /* @__PURE__ */ Symbol("openApiCoverageErrorBody");
function snapshot(payload) {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return void 0;
  }
}
function registerCoverageHooks(app, options = {}) {
  const recorder = options.recorder ?? new Recorder();
  const autoAssert = options.autoAssertOnInject !== false;
  const recordRawBody = options.recordRawBody !== false;
  if (recordRawBody) {
    app.addHook("preSerialization", function preSerializationCaptureRawBody(request, _reply, payload, done) {
      ;
      request[RAW_BODY] = snapshot(payload);
      done(null, payload);
    });
    app.addHook("onError", function onErrorCaptureErrorBody(request, reply, error, done) {
      const statusCode = reply.statusCode >= 400 ? reply.statusCode : Number(error.statusCode) || 500;
      request[ERROR_BODY] = {
        statusCode,
        ...error.code !== void 0 ? { code: error.code } : {},
        error: STATUS_CODES[statusCode] ?? "Error",
        message: error.message
      };
      done();
    });
  }
  app.addHook("onSend", function onSendCapturePayload(request, _reply, payload, done) {
    ;
    request._openApiCoveragePayload = payload;
    done();
  });
  app.addHook("onResponse", function onResponseRecordCoverage(request, reply, done) {
    let pathname = request.url ? request.url.split("?")[0] : request.raw?.url?.split("?")[0] || "/";
    pathname = pathname?.replace(/\/+$/, "") || "/";
    let responseBody = null;
    const raw = request._openApiCoveragePayload;
    if (raw !== void 0) {
      if (typeof raw === "object" && raw !== null) {
        responseBody = raw;
      } else if (typeof raw === "string") {
        try {
          responseBody = JSON.parse(raw);
        } catch {
          responseBody = null;
        }
      }
    }
    recorder.record({
      method: request.method,
      pathname,
      pathParams: request.params || {},
      queryParams: request.query || {},
      requestContentType: request.headers?.["content-type"] || null,
      responseStatusCode: reply.statusCode,
      responseContentType: reply.getHeader?.("content-type") || null,
      responseBody,
      responseRawBody: request[RAW_BODY],
      responseErrorBody: request[RAW_BODY] === void 0 ? request[ERROR_BODY] : void 0
    });
    done();
  });
  if (autoAssert) {
    const originalInject = app.inject.bind(app);
    app.inject = function injectWithAsserted(...args) {
      return originalInject(...args).then((result) => {
        recorder.markLastResponseAsserted();
        return result;
      });
    };
  }
  return recorder;
}
export {
  registerCoverageHooks
};
//# sourceMappingURL=fastify.js.map