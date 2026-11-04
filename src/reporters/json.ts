import fs from 'node:fs'
import path from 'node:path'
import type { CoverageResult, ConformanceResult, ConformanceComparison } from '../types.js'

export function writeJsonReport(coverage: CoverageResult, filepath: string): void {
  const dir = path.dirname(filepath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filepath, JSON.stringify(coverage, null, 2), 'utf8')
}

export function writeConformanceJsonReport(
  result: ConformanceResult,
  comparison: ConformanceComparison,
  filepath: string,
): void {
  const dir = path.dirname(filepath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const report = {
    checked: result.checked,
    new: comparison.new,
    baselined: comparison.baselined,
    allowed: comparison.allowed,
    stale: comparison.stale,
    skipped: result.skipped,
    /** The baseline that accepts the current state: every violation that is not allowed. */
    baselineKeys: [...comparison.baselined, ...comparison.new].map(v => v.key).sort(),
  }
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8')
}
