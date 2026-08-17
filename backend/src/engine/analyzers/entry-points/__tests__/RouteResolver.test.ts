/**
 * KSA-162 — Unit tests for RouteResolver path composition and normalization.
 */

import { describe, it, expect } from 'vitest';
import { RouteResolver } from '../RouteResolver.js';

describe('RouteResolver', () => {
  const resolver = new RouteResolver();

  it('resolves a method path with no prefix', () => {
    expect(resolver.resolve(null, '/users')).toBe('/users');
    expect(resolver.resolve('', '/users')).toBe('/users');
  });

  it('joins controller prefix and method path', () => {
    expect(resolver.resolve('api', 'users')).toBe('/api/users');
    expect(resolver.resolve('/api/', '/users/')).toBe('/api/users');
  });

  it('returns prefix when method path is empty or root', () => {
    expect(resolver.resolve('api', '')).toBe('/api');
    expect(resolver.resolve('api', '/')).toBe('/api');
  });

  it('returns root path when everything is empty', () => {
    expect(resolver.resolve(null, '')).toBe('/');
  });

  it('normalizes express style params', () => {
    expect(resolver.normalizeParams('/users/:id')).toBe('/users/{id}');
    expect(resolver.normalizeParams('/users/:user_id/posts')).toBe('/users/{user_id}/posts');
  });

  it('normalizes flask style params', () => {
    expect(resolver.normalizeParams('/u/<name>')).toBe('/u/{name}');
    expect(resolver.normalizeParams('/u/<int:uid>')).toBe('/u/<int{uid}>');
  });

  it('leaves already-normalized params untouched', () => {
    expect(resolver.normalizeParams('/x/{y}')).toBe('/x/{y}');
  });

  it('extracts and normalizes a route path from an argument string', () => {
    expect(resolver.extractPathFromArg("'/users/:id'")).toBe('/users/{id}');
    expect(resolver.extractPathFromArg('"say-hi"')).toBe('say-hi');
    expect(resolver.extractPathFromArg('`/v1/u/:uid`')).toBe('/v1/u/{uid}');
  });

  it('extractPathFromArg returns the stripped value when unmatched', () => {
    expect(resolver.extractPathFromArg('plain')).toBe('plain');
  });
});