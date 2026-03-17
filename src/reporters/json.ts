import fs from 'node:fs'
import path from 'node:path'
import type { CoverageResult } from '../types.js'

export function writeJsonReport(coverage: CoverageResult, filepath: string): void {
  const dir = path.dirname(filepath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filepath, JSON.stringify(coverage, null, 2), 'utf8')
}
