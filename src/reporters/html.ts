import fs from 'node:fs'
import path from 'node:path'
import type { CoverageResult, CoverageMetric } from '../types.js'

export function writeHtmlReport(coverage: CoverageResult, filepath: string): void {
  const dir = path.dirname(filepath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const row = (label: string, metric: CoverageMetric): string => {
    const pct = metric.total ? ((metric.covered / metric.total) * 100).toFixed(1) : '0'
    const cls = metric.total === 0 ? 'dim' : Number(pct) >= 100 ? 'ok' : Number(pct) >= 50 ? 'warn' : 'fail'
    return `<tr><td>${label}</td><td class="${cls}">${metric.covered}/${metric.total}</td><td class="${cls}">${pct}%</td></tr>`
  }

  const rows = [
    row('Paths', coverage.path),
    row('Operations', coverage.operation),
    row('Status codes', coverage.statusCode),
    row('Parameters', coverage.parameter),
    row('Parameter values', coverage.parameterValue),
    row('Response body props', coverage.responseBodyProperties),
    row('Response asserted', coverage.responseAsserted),
    row('Input content-type', coverage.inputContentType),
    row('Output content-type', coverage.outputContentType),
    row('Status code class', coverage.statusCodeClass),
  ].join('')

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
`
  fs.writeFileSync(filepath, html, 'utf8')
}
