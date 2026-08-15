/**
 * KSA-161 — Unit tests for GradeAssigner letter-grade thresholds.
 */

import { describe, it, expect } from 'vitest';
import { GradeAssigner } from '../GradeAssigner.js';

describe('GradeAssigner', () => {
  it('assigns grades at default thresholds', () => {
    const assigner = new GradeAssigner();
    expect(assigner.assignGrade(0)).toBe('A');
    expect(assigner.assignGrade(5)).toBe('A');
    expect(assigner.assignGrade(6)).toBe('B');
    expect(assigner.assignGrade(10)).toBe('B');
    expect(assigner.assignGrade(11)).toBe('C');
    expect(assigner.assignGrade(20)).toBe('C');
    expect(assigner.assignGrade(21)).toBe('D');
    expect(assigner.assignGrade(50)).toBe('D');
    expect(assigner.assignGrade(51)).toBe('F');
  });

  it('handles edge values exactly on thresholds', () => {
    const assigner = new GradeAssigner();
    expect(assigner.assignGrade(5)).toBe('A');
    expect(assigner.assignGrade(10)).toBe('B');
    expect(assigner.assignGrade(20)).toBe('C');
    expect(assigner.assignGrade(50)).toBe('D');
  });

  it('applies partial custom thresholds', () => {
    const assigner = new GradeAssigner({ B: 15 });
    expect(assigner.assignGrade(5)).toBe('A');
    expect(assigner.assignGrade(6)).toBe('B');
    expect(assigner.assignGrade(16)).toBe('C');
  });

  it('merges custom thresholds over defaults', () => {
    const assigner = new GradeAssigner({ A: 1, D: 100 });
    expect(assigner.assignGrade(1)).toBe('A');
    expect(assigner.assignGrade(2)).toBe('B');
    expect(assigner.assignGrade(101)).toBe('F');
  });

  it('getThresholds returns a defensive copy', () => {
    const assigner = new GradeAssigner();
    const thresholds = assigner.getThresholds();
    thresholds.A = 99;
    expect(assigner.getThresholds().A).toBe(5);
  });

  it('assigns A for negative complexity', () => {
    const assigner = new GradeAssigner();
    expect(assigner.assignGrade(-5)).toBe('A');
  });
});