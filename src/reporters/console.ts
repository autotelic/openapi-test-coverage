import { bold, cyan, green, yellow, red, dim, gray } from 'colorette'
import type { CoverageResult, CoverageMetric } from '../types.js'

function ratioColour(covered: number, total: number): string {
  if (total === 0) return gray('0/0')
  const pct = (covered / total) * 100
  const str = `${covered}/${total}`
  if (pct >= 100) return green(str)
  if (pct >= 50) return yellow(str)
  return red(str)
}

export interface PrintReportOptions {
  verbose?: boolean
  maxMissingItems?: number
}

export function printReport(coverage: CoverageResult, opts: PrintReportOptions = {}): void {
  const { verbose = false, maxMissingItems = 15 } = opts

  const tclLabel =
    '0=none, 1=paths, 2=+operations, 3=+content-types, 4=+params+statusClass, 5=+param values+statusCodes, 6=+response body props'
  const tclStr =
    coverage.tcl >= 4 ? green(String(coverage.tcl)) : coverage.tcl >= 1 ? yellow(String(coverage.tcl)) : red(String(coverage.tcl))

  console.log()
  console.log(bold(cyan('--- OpenAPI coverage ---')))
  console.log(bold('TCL:'), tclStr, dim(`(${tclLabel})`))
  console.log(dim('  Paths:               '), ratioColour(coverage.path.covered, coverage.path.total))
  console.log(dim('  Operations:          '), ratioColour(coverage.operation.covered, coverage.operation.total))
  console.log(dim('  Status codes:        '), ratioColour(coverage.statusCode.covered, coverage.statusCode.total))
  console.log(dim('  Parameters:          '), ratioColour(coverage.parameter.covered, coverage.parameter.total))
  console.log(dim('  Parameter values:    '), ratioColour(coverage.parameterValue.covered, coverage.parameterValue.total))
  console.log(dim('  Response body props:  '), ratioColour(coverage.responseBodyProperties.covered, coverage.responseBodyProperties.total))
  console.log(dim('  Response asserted:    '), ratioColour(coverage.responseAsserted.covered, coverage.responseAsserted.total))
  console.log(dim('  Input content-type:   '), ratioColour(coverage.inputContentType.covered, coverage.inputContentType.total))
  console.log(dim('  Output content-type: '), ratioColour(coverage.outputContentType.covered, coverage.outputContentType.total))
  console.log(dim('  Status code class:   '), ratioColour(coverage.statusCodeClass.covered, coverage.statusCodeClass.total))
  console.log(dim('-------------------------------------------'))
  console.log()

  if (verbose) {
    const showMissing = (label: string, metric: CoverageMetric) => {
      if (metric.missing.length === 0) return
      console.log(bold(yellow(label)))
      metric.missing.slice(0, maxMissingItems).forEach(item => console.log(dim('  ') + gray(item)))
      if (metric.missing.length > maxMissingItems) {
        console.log(dim(`  ... and ${metric.missing.length - maxMissingItems} more`))
      }
      console.log()
    }
    showMissing('Missing paths:', coverage.path)
    showMissing('Missing operations:', coverage.operation)
    showMissing('Missing status codes:', coverage.statusCode)
    showMissing('Missing parameters:', coverage.parameter)
    showMissing('Missing parameter values:', coverage.parameterValue)
    showMissing('Missing response body properties:', coverage.responseBodyProperties)
    showMissing('Missing response asserted:', coverage.responseAsserted)
    showMissing('Missing input content-types:', coverage.inputContentType)
    showMissing('Missing output content-types:', coverage.outputContentType)
    showMissing('Missing status code classes:', coverage.statusCodeClass)
  }
}
