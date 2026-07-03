/**
 * KSA-161: Grade assignment based on cyclomatic complexity thresholds.
 */

import type { Grade, GradeThresholds } from './types.js';

const DEFAULT_THRESHOLDS: GradeThresholds = {
  A: 5,
  B: 10,
  C: 20,
  D: 50,
};

export class GradeAssigner {
  private thresholds: GradeThresholds;

  constructor(thresholds?: Partial<GradeThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /** Assign a letter grade based on cyclomatic complexity score. */
  assignGrade(cc: number): Grade {
    if (cc <= this.thresholds.A) return 'A';
    if (cc <= this.thresholds.B) return 'B';
    if (cc <= this.thresholds.C) return 'C';
    if (cc <= this.thresholds.D) return 'D';
    return 'F';
  }

  /** Get the current thresholds. */
  getThresholds(): GradeThresholds {
    return { ...this.thresholds };
  }
}
