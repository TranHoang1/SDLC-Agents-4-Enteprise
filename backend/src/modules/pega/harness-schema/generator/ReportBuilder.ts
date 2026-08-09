/**
 * SA4E-95 - ReportBuilder: constructs GenerationReport from per-type results.
 * Extracted from HarnessSchemaGenerator for SRP compliance.
 */
import type { GenerationReport, SchemaDetail } from '../models/GenerationReport.js';

/**
 * Builds generation reports from individual schema generation details.
 */
export class ReportBuilder {
  /** Build a GenerationReport from collected details */
  build(details: SchemaDetail[], startTime: number): GenerationReport {
    const generated = details.filter((d) => d.status === 'generated').length;
    const skipped = details.filter((d) => d.status === 'skipped').length;
    const failed = details.filter((d) => d.status === 'failed').length;

    const coverages = details
      .filter((d) => d.coverage != null)
      .map((d) => d.coverage!);
    const avgCoverage =
      coverages.length > 0
        ? coverages.reduce((a, b) => a + b, 0) / coverages.length
        : 0;

    return {
      totalRuleTypes: details.length,
      generated,
      skipped,
      failed,
      averageCoverage: Math.round(avgCoverage * 100) / 100,
      duration: Date.now() - startTime,
      details,
    };
  }

  /** Create a detail entry for a successful generation */
  successDetail(
    ruleType: string, coverage: number, fieldCount: number,
    templateSections: string[], duration: number
  ): SchemaDetail {
    return {
      ruleType, status: 'generated', coverage,
      fieldCount, templateSections, duration,
    };
  }

  /** Create a detail entry for a failed generation */
  failureDetail(ruleType: string, error: string, duration: number): SchemaDetail {
    return { ruleType, status: 'failed', error, duration };
  }

  /** Create a detail entry for a skipped (cached) generation */
  skippedDetail(ruleType: string, duration: number): SchemaDetail {
    return { ruleType, status: 'skipped', duration };
  }
}
