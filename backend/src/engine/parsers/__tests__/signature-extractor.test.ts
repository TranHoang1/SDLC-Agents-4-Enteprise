/**
 * SA4E — Unit tests for multi-language regex symbol extraction.
 */

import { describe, it, expect } from 'vitest';
import { extractSymbols } from '../signature-extractor.js';

describe('extractSymbols — TypeScript/JavaScript', () => {
  it('extracts functions, classes, interfaces, types and enums', () => {
    const src = [
      'export function helper() {}',
      'async function run() {}',
      'function plain() {}',
      'export class Service {}',
      'class Local {}',
      'export interface Props {}',
      'export type DeepPartial = { a?: boolean };',
      'export enum Color { Red }',
    ].join('\n');

    const symbols = extractSymbols(src, 'typescript');
    const byName = Object.fromEntries(symbols.map(s => [s.name, s]));
    expect(byName.helper.kind).toBe('function');
    expect(byName.run.kind).toBe('function');
    expect(byName.plain.kind).toBe('function');
    expect(byName.Service.kind).toBe('class');
    expect(byName.Local.kind).toBe('class');
    expect(byName.Props.kind).toBe('interface');
    expect(byName.DeepPartial.kind).toBe('type');
    expect(byName.Color.kind).toBe('enum');
  });

  it('extracts const arrow-function assignments', () => {
    const symbols = extractSymbols('const handler = async (x) => {\n  return x;\n};', 'typescript');
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({ name: 'handler', kind: 'function' });
  });

  it('records export visibility', () => {
    const [sym] = extractSymbols('export function foo() {}', 'typescript');
    expect(sym.visibility).toBe('export');
  });

  it('does not match non-arrow const initializers', () => {
    const symbols = extractSymbols('const value = 42;', 'typescript');
    expect(symbols).toHaveLength(0);
  });

  it('records startLine as 1-based', () => {
    const [sym] = extractSymbols('const a = 1;\nfunction deep() {}', 'typescript');
    expect(sym.startLine).toBe(2);
  });
});

describe('extractSymbols — multi-language', () => {
  it('extracts kotlin functions and classes', () => {
    const symbols = extractSymbols('private fun surface() {}\ninternal class Repo {}', 'kotlin');
    const byName = Object.fromEntries(symbols.map(s => [s.name, s]));
    expect(byName.surface.kind).toBe('function');
    expect(byName.surface.visibility).toBe('private');
    expect(byName.Repo.kind).toBe('class');
    expect(byName.Repo.visibility).toBe('internal');
  });

  it('extracts python def and class', () => {
    const symbols = extractSymbols('def run():\n    pass\n\nclass Model:\n    pass', 'python');
    expect(symbols.map(s => [s.name, s.kind])).toContainEqual(['run', 'function']);
    expect(symbols.map(s => [s.name, s.kind])).toContainEqual(['Model', 'class']);
  });

  it('extracts java methods and classes', () => {
    const symbols = extractSymbols('public class Main {\n  public static void run(String[] args) {}\n}', 'java');
    const byName = Object.fromEntries(symbols.map(s => [s.name, s.kind]));
    expect(byName.Main).toBe('class');
    expect(byName.run).toBe('function');
  });

  it('extracts go functions, structs and interfaces', () => {
    const symbols = extractSymbols('func (s *Server) Handle() {}\ntype Config struct{}\ntype Store interface{}', 'go');
    const byName = Object.fromEntries(symbols.map(s => [s.name, s.kind]));
    expect(byName.Handle).toBe('function');
    expect(byName.Config).toBe('struct');
    expect(byName.Store).toBe('interface');
  });

  it('extracts rust fn, struct, trait, enum and mod', () => {
    const symbols = extractSymbols('pub fn main() {}\npub struct Point{}\npub trait Draw{}\npub enum Mode{}\nmod util;', 'rust');
    const byName = Object.fromEntries(symbols.map(s => [s.name, s.kind]));
    expect(byName.main).toBe('function');
    expect(byName.Point).toBe('struct');
    expect(byName.Draw).toBe('trait');
    expect(byName.Mode).toBe('enum');
    expect(byName.util).toBe('module');
  });

  it('uses generic patterns for unknown languages', () => {
    const symbols = extractSymbols('function foo() {}\nclass Bar {}', 'unknownlang');
    expect(symbols.map(s => s.name)).toEqual(['foo', 'Bar']);
  });

  it('extracts apex classes, interfaces, enums, triggers and methods', () => {
    const src = [
      'public with sharing class AccountService {',
      '  public void processAccount(Account acc) {}',
      '  private static List<Account> getAccounts() {}',
      '}',
      'public interface IAccountHandler {}',
      'public enum Status { NEW_STATUS, ACTIVE, CLOSED }',
      'trigger AccountTrigger on Account (before insert, after update) {}',
    ].join('\n');
    const symbols = extractSymbols(src, 'apex');
    const byName = Object.fromEntries(symbols.map(s => [s.name, s.kind]));
    expect(byName.AccountService).toBe('class');
    expect(byName.IAccountHandler).toBe('interface');
    expect(byName.Status).toBe('enum');
    expect(byName.AccountTrigger).toBe('function');
    expect(byName.processAccount).toBe('method');
    expect(byName.getAccounts).toBe('method');
  });
});

describe('extractSymbols — edge cases', () => {
  it('estimates endLine from brace balance', () => {
    const [sym] = extractSymbols('function wrap() {\n  if (x) {\n    return 1;\n  }\n}', 'typescript');
    expect(sym.endLine).toBe(5);
  });

  it('caps endLine estimate within 200 lines of the start', () => {
    const body = Array.from({ length: 220 }, (_, i) => `  { value.push(${i}); }`).join('\n');
    const [sym] = extractSymbols(`function huge() {\n${body}\n}`, 'typescript');
    expect(sym.endLine).toBeLessThanOrEqual(202);
  });

  it('extracts a leading doc comment', () => {
    const [sym] = extractSymbols('/** Adds two numbers. */\nfunction add(a, b) { return a + b; }', 'typescript');
    expect(sym.docComment).toContain('Adds two numbers');
  });

  it('returns null docComment without one', () => {
    const [sym] = extractSymbols('function add() {}', 'typescript');
    expect(sym.docComment).toBeNull();
  });

  it('skips long names (>100 chars)', () => {
    const src = `function ${'a'.repeat(120)}() {}`;
    expect(extractSymbols(src, 'typescript')).toHaveLength(0);
  });

  it('deduplicates symbols sharing name and startLine', () => {
    const src = 'export function run() {}\nfunction run() {}';
    const symbols = extractSymbols(src, 'typescript');
    expect(symbols.filter(s => s.name === 'run')).toHaveLength(2);
    expect(new Set(symbols.map(s => `${s.name}:${s.startLine}`)).size).toBe(symbols.length);
  });

  it('truncates signature to 500 chars', () => {
    const name = 'longFunc';
    const params = 'a'.repeat(400);
    const src = `function ${name}(${params}) { return 1; }`;
    const [sym] = extractSymbols(src, 'typescript');
    expect(sym.signature.length).toBeLessThanOrEqual(500);
  });
});