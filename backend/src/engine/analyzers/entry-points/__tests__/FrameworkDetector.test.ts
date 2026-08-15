/**
 * KSA-162 — Unit tests for FrameworkDetector import-based detection.
 */

import { describe, it, expect } from 'vitest';
import { PatternRegistry } from '../PatternRegistry.js';
import { FrameworkDetector } from '../FrameworkDetector.js';

describe('FrameworkDetector', () => {
  const detector = new FrameworkDetector(new PatternRegistry());

  it('detects express with High confidence when multiple patterns match', () => {
    const result = detector.detect("import express from 'express'", 'typescript');
    expect(result).toEqual({ name: 'express', language: 'typescript', confidence: 'High' });
  });

  it('detects a framework with Medium confidence on a single match', () => {
    const result = detector.detect('const app = require("express")', 'typescript');
    expect(result?.name).toBe('express');
    expect(result?.confidence).toBe('Medium');
  });

  it('detects nestjs from an import', () => {
    const result = detector.detect("import { Controller } from '@nestjs/common'", 'typescript');
    expect(result?.name).toBe('nestjs');
    expect(result?.confidence).toBe('Medium');
  });

  it('returns null when nothing matches', () => {
    expect(detector.detect('import fs from "fs"', 'typescript')).toBeNull();
  });

  it('returns null for unsupported languages even with known keywords', () => {
    expect(detector.detect('import express from "express"', 'ruby')).toBeNull();
  });

  it('detects from a list of import strings with High confidence', () => {
    const result = detector.detectFromImports(['helpers', '@nestjs/core'], 'typescript');
    expect(result?.name).toBe('nestjs');
    expect(result?.confidence).toBe('High');
  });

  it('detectFromImports returns null when the language has no import matches', () => {
    expect(detector.detectFromImports(['fastapi'], 'typescript')).toBeNull();
  });

  it('detectFromImports returns null for languages with no registered frameworks', () => {
    expect(detector.detectFromImports(['anything'], 'ruby')).toBeNull();
  });
});