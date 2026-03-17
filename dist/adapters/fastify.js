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
function registerCoverageHooks(app, options = {}) {
  const recorder = options.recorder ?? new Recorder();
  const autoAssert = options.autoAssertOnInject !== false;
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
      responseBody
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