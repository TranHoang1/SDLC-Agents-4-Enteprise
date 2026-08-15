/**
 * KSA-162 — Unit tests for HTTPHandlerDetector route and framework detection.
 */

import { describe, it, expect } from 'vitest';
import { PatternRegistry } from '../PatternRegistry.js';
import { HTTPHandlerDetector } from '../detectors/HTTPHandlerDetector.js';

const detector = new HTTPHandlerDetector(new PatternRegistry());

describe('HTTPHandlerDetector', () => {
  it('detects NestJS decorator handlers with controller prefix and auth', () => {
    const symbols = [
      {
        id: 1, name: 'UsersController', parentName: null,
        decorators: ['@Controller("users")'],
        filePath: 'users.controller.ts', startLine: 0,
      },
      {
        id: 2, name: 'list', parentName: 'UsersController',
        decorators: ['@Get(":id")', '@UseGuards(AuthGuard)'],
        filePath: 'users.controller.ts', startLine: 5,
      },
    ];
    const result = detector.detectFromSymbols(symbols, 'nestjs', '');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      entry_type: 'HTTP_HANDLER',
      framework: 'nestjs',
      http_method: 'GET',
      route_path: '{id}',
      full_route: '/users/{id}',
      controller: 'UsersController',
      has_auth: true,
      middleware: ['@UseGuards(AuthGuard)'],
      confidence: 'High',
    });
  });

  it('detects FastAPI handlers with router prefix', () => {
    const symbols = [
      { id: 1, name: 'router', decorators: ['APIRouter(prefix="/api/v1")'], filePath: 'a.py', startLine: 0 },
      { id: 2, name: 'create', decorators: ['@router.post("/items")'], filePath: 'a.py', startLine: 3 },
    ];
    const result = detector.detectFromSymbols(symbols, 'fastapi', '');
    expect(result[0]).toMatchObject({
      http_method: 'POST',
      route_path: '/items',
      full_route: '/api/v1/items',
    });
  });

  it('detects FastAPI auth via Depends indicators', () => {
    const symbols = [
      { id: 9, name: 'me', decorators: ['@app.get("/me")', 'Depends(get_current_user)'], filePath: 'a.py', startLine: 0 },
    ];
    const result = detector.detectFromSymbols(symbols, 'fastapi', '');
    expect(result[0].has_auth).toBe(true);
  });

  it('detects Express call-pattern handlers from source context', () => {
    const source = [
      "const express = require('express');",
      'const app = express();',
      "app.get('/health', (req, res) => res.send('ok'));",
    ].join('\n');
    const symbols = [{ id: 3, name: 'health', parentName: null, filePath: 'server.js', startLine: 2 }];
    const result = detector.detectFromSymbols(symbols, 'express', source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      http_method: 'GET',
      route_path: '/health',
      full_route: '/health',
      confidence: 'Medium',
      has_auth: false,
    });
  });

  it('returns empty for unknown frameworks', () => {
    const result = detector.detectFromSymbols([], 'unknown', '');
    expect(result).toEqual([]);
  });

  it('returns empty when no decorators or call patterns match', () => {
    const symbols = [
      { id: 5, name: 'plain', parentName: null, decorators: ['@Log()'], filePath: 'a.ts', startLine: 0 },
    ];
    expect(detector.detectFromSymbols(symbols, 'nestjs', '')).toEqual([]);
  });
});