import { DetectionResult, PatternCategory } from '../models/MaskingTypes.js';

/**
 * Strategy interface for all detection implementations.
 * Each detector is responsible for finding one category of sensitive data.
 */
export interface DetectorStrategy {
  readonly category: PatternCategory;
  detect(content: string): DetectionResult[];
}
