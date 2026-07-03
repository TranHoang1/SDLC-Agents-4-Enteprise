/**
 * KSA-151: Rust Parser — Unit Tests.
 * Tests symbol extraction, relationship detection, and Rust-specific features.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Parser, Language } from 'web-tree-sitter';
import * as fs from 'fs';
import * as path from 'path';
import RustParser from '../rust-parser.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

let rustParser: RustParser;

async function setup() {
  await Parser.init();
  const parser = new Parser();
  const wasmPath = path.resolve(
    __dirname,
    '../../grammars/tree-sitter-rust.wasm'
  );
  if (!fs.existsSync(wasmPath)) {
    console.error(`[skip] Rust WASM grammar not found at ${wasmPath}`);
    return null;
  }
  const language = await Language.load(wasmPath);
  parser.setLanguage(language);
  return new RustParser(parser, 'rust');
}

describe('RustParser', async () => {
  before(async () => {
    const p = await setup();
    if (!p) {
      console.error('Skipping Rust parser tests — WASM grammar not available');
      return;
    }
    rustParser = p;
  });

  describe('Symbol Extraction', () => {
    it('should extract functions', () => {
      if (!rustParser) return;
      const source = `pub fn hello(name: &str) -> String {
    format!("Hello, {}", name)
}

fn private_helper() {}`;
      const result = rustParser.parse(source, 'test.rs');
      const funcs = result.symbols.filter(s => s.kind === 'function');
      assert.equal(funcs.length, 2);

      const hello = funcs.find(f => f.name === 'hello')!;
      assert.equal(hello.isExported, true);
      assert.equal(hello.returnType, 'String');
      assert.ok(hello.signature.includes('fn hello'));

      const helper = funcs.find(f => f.name === 'private_helper')!;
      assert.equal(helper.isExported, false);
    });

    it('should extract async/unsafe functions', () => {
      if (!rustParser) return;
      const source = `pub async fn fetch(url: &str) -> Result<Vec<u8>, Error> {
    Ok(vec![])
}

pub unsafe fn raw_ptr(p: *mut u8) -> u8 {
    *p
}`;
      const result = rustParser.parse(source, 'test.rs');
      const funcs = result.symbols.filter(s => s.kind === 'function');

      const fetch = funcs.find(f => f.name === 'fetch')!;
      assert.equal(fetch.isAsync, true);
      assert.ok(fetch.modifiers?.includes('async'));

      const raw = funcs.find(f => f.name === 'raw_ptr')!;
      assert.ok(raw.modifiers?.includes('unsafe'));
    });

    it('should extract structs', () => {
      if (!rustParser) return;
      const source = `pub struct Config {
    host: String,
    port: u16,
}

struct Internal {
    data: Vec<u8>,
}`;
      const result = rustParser.parse(source, 'test.rs');
      const structs = result.symbols.filter(s => s.kind === 'struct');
      assert.equal(structs.length, 2);

      const config = structs.find(s => s.name === 'Config')!;
      assert.equal(config.isExported, true);

      const internal = structs.find(s => s.name === 'Internal')!;
      assert.equal(internal.isExported, false);
    });

    it('should extract enums', () => {
      if (!rustParser) return;
      const source = `pub enum Status {
    Active,
    Inactive,
    Error(String),
}`;
      const result = rustParser.parse(source, 'test.rs');
      const enums = result.symbols.filter(s => s.kind === 'enum');
      assert.equal(enums.length, 1);
      assert.equal(enums[0].name, 'Status');
    });

    it('should extract traits', () => {
      if (!rustParser) return;
      const source = `pub trait Serializable {
    fn serialize(&self) -> Vec<u8>;
    fn deserialize(data: &[u8]) -> Self;
}`;
      const result = rustParser.parse(source, 'test.rs');
      const traits = result.symbols.filter(s => s.kind === 'trait');
      assert.equal(traits.length, 1);
      assert.equal(traits[0].name, 'Serializable');

      // Trait methods should be extracted
      const methods = result.symbols.filter(s => s.kind === 'method' || (s.kind === 'function' && s.parentName === 'Serializable'));
      assert.ok(methods.length >= 2);
    });

    it('should extract impl blocks and methods', () => {
      if (!rustParser) return;
      const source = `struct Server {
    port: u16,
}

impl Server {
    pub fn new(port: u16) -> Self {
        Self { port }
    }

    pub fn start(&self) {
        println!("Starting on port {}", self.port);
    }

    fn internal_setup(&mut self) {}
}`;
      const result = rustParser.parse(source, 'test.rs');

      // Should have impl namespace
      const impls = result.symbols.filter(s => s.name.startsWith('impl '));
      assert.ok(impls.length >= 1);

      // Should have methods with parentName = Server
      const methods = result.symbols.filter(s => s.parentName === 'Server');
      assert.equal(methods.length, 3);
      assert.ok(methods.some(m => m.name === 'new'));
      assert.ok(methods.some(m => m.name === 'start'));
      assert.ok(methods.some(m => m.name === 'internal_setup'));
    });

    it('should extract trait implementations', () => {
      if (!rustParser) return;
      const source = `struct MyStruct;

trait Display {
    fn fmt(&self) -> String;
}

impl Display for MyStruct {
    fn fmt(&self) -> String {
        "MyStruct".to_string()
    }
}`;
      const result = rustParser.parse(source, 'test.rs');
      const implRels = result.relationships.filter(r => r.kind === 'implements');
      assert.ok(implRels.some(r => r.sourceSymbol === 'MyStruct' && r.targetSymbol === 'Display'));
    });

    it('should extract modules', () => {
      if (!rustParser) return;
      const source = `pub mod utils {
    pub fn helper() -> i32 {
        42
    }
}

mod internal;`;
      const result = rustParser.parse(source, 'test.rs');
      const modules = result.symbols.filter(s => s.kind === 'module');
      assert.equal(modules.length, 2);
      assert.ok(modules.some(m => m.name === 'utils'));
      assert.ok(modules.some(m => m.name === 'internal'));

      // Inline module should have children
      const helperFn = result.symbols.find(s => s.name === 'helper');
      assert.ok(helperFn);
      assert.equal(helperFn!.parentName, 'utils');
    });

    it('should extract macro definitions', () => {
      if (!rustParser) return;
      const source = `macro_rules! my_macro {
    ($x:expr) => { $x + 1 };
}`;
      const result = rustParser.parse(source, 'test.rs');
      const macros = result.symbols.filter(s => s.modifiers?.includes('macro'));
      assert.equal(macros.length, 1);
      assert.equal(macros[0].name, 'my_macro');
    });

    it('should extract constants and statics', () => {
      if (!rustParser) return;
      const source = `pub const MAX_SIZE: usize = 1024;
static mut COUNTER: u32 = 0;`;
      const result = rustParser.parse(source, 'test.rs');
      assert.ok(result.symbols.some(s => s.name === 'MAX_SIZE'));
      assert.ok(result.symbols.some(s => s.name === 'COUNTER'));
    });
  });

  describe('Relationship Extraction', () => {
    it('should extract use declarations (simple)', () => {
      if (!rustParser) return;
      const source = `use std::collections::HashMap;
use std::io::Read;

fn main() {}`;
      const result = rustParser.parse(source, 'test.rs');
      const imports = result.relationships.filter(r => r.kind === 'imports');
      assert.ok(imports.some(i => i.targetSymbol === 'std::collections::HashMap'));
      assert.ok(imports.some(i => i.targetSymbol === 'std::io::Read'));
    });

    it('should expand grouped use paths', () => {
      if (!rustParser) return;
      const source = `use std::io::{self, Read, Write};

fn main() {}`;
      const result = rustParser.parse(source, 'test.rs');
      const imports = result.relationships.filter(r => r.kind === 'imports');
      assert.ok(imports.length >= 3, `Expected >= 3 imports, got ${imports.length}`);
    });

    it('should handle glob imports', () => {
      if (!rustParser) return;
      const source = `use std::prelude::*;

fn main() {}`;
      const result = rustParser.parse(source, 'test.rs');
      const imports = result.relationships.filter(r => r.kind === 'imports');
      const globImport = imports.find(i => i.metadata?.glob === true);
      assert.ok(globImport);
    });

    it('should handle pub use (re-exports)', () => {
      if (!rustParser) return;
      const source = `pub use crate::config::Settings;

fn main() {}`;
      const result = rustParser.parse(source, 'test.rs');
      const imports = result.relationships.filter(r => r.kind === 'imports');
      const pubUse = imports.find(i => i.metadata?.pub_use === true);
      assert.ok(pubUse);
    });

    it('should extract function calls', () => {
      if (!rustParser) return;
      const source = `fn main() {
    let x = compute(42);
    process(x);
}

fn compute(n: i32) -> i32 { n * 2 }
fn process(n: i32) {}`;
      const result = rustParser.parse(source, 'test.rs');
      const calls = result.relationships.filter(r => r.kind === 'calls');
      assert.ok(calls.some(c => c.targetSymbol === 'compute'));
      assert.ok(calls.some(c => c.targetSymbol === 'process'));
    });

    it('should extract macro invocations as calls', () => {
      if (!rustParser) return;
      const source = `fn main() {
    println!("hello");
    vec![1, 2, 3];
}`;
      const result = rustParser.parse(source, 'test.rs');
      const calls = result.relationships.filter(r => r.kind === 'calls' && r.metadata?.macro);
      assert.ok(calls.length >= 1);
    });

    it('should extract derive macro implementations', () => {
      if (!rustParser) return;
      const source = `#[derive(Debug, Clone, Serialize)]
pub struct Config {
    name: String,
}`;
      const result = rustParser.parse(source, 'test.rs');
      const implRels = result.relationships.filter(r =>
        r.kind === 'implements' && r.metadata?.derived === true
      );
      assert.ok(implRels.some(r => r.sourceSymbol === 'Config' && r.targetSymbol === 'Debug'));
      assert.ok(implRels.some(r => r.sourceSymbol === 'Config' && r.targetSymbol === 'Clone'));
      assert.ok(implRels.some(r => r.sourceSymbol === 'Config' && r.targetSymbol === 'Serialize'));
    });
  });

  describe('Rust-Specific Features', () => {
    it('should handle visibility modifiers', () => {
      if (!rustParser) return;
      const source = `pub fn public_fn() {}
pub(crate) fn crate_fn() {}
fn private_fn() {}`;
      const result = rustParser.parse(source, 'test.rs');
      const funcs = result.symbols.filter(s => s.kind === 'function');

      const pubFn = funcs.find(f => f.name === 'public_fn')!;
      assert.equal(pubFn.isExported, true);

      const crateFn = funcs.find(f => f.name === 'crate_fn')!;
      assert.equal(crateFn.isExported, true);

      const privFn = funcs.find(f => f.name === 'private_fn')!;
      assert.equal(privFn.isExported, false);
    });

    it('should parse fixture file without errors', () => {
      if (!rustParser) return;
      const fixturePath = path.join(FIXTURES_DIR, 'simple.rs');
      if (!fs.existsSync(fixturePath)) return;
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const result = rustParser.parse(source, 'simple.rs');

      // Should have symbols
      assert.ok(result.symbols.length > 0, 'Should extract symbols');

      // Should have various kinds
      assert.ok(result.symbols.some(s => s.kind === 'function'));
      assert.ok(result.symbols.some(s => s.kind === 'struct'));
      assert.ok(result.symbols.some(s => s.kind === 'enum'));
      assert.ok(result.symbols.some(s => s.kind === 'trait'));

      // Should have relationships
      assert.ok(result.relationships.length > 0, 'Should extract relationships');

      // Should have imports
      assert.ok(result.relationships.some(r => r.kind === 'imports'));
    });
  });
});
