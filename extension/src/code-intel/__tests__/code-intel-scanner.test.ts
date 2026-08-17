/**
 * Unit tests for CodeIntelScanner — symbol/import/export extraction via TS compiler API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CodeIntelScanner } from "../CodeIntelScanner";

describe("CodeIntelScanner", () => {
  let scanner: CodeIntelScanner;

  beforeEach(() => {
    scanner = new CodeIntelScanner();
  });

  it("extracts function, class, interface, and variable symbols", () => {
    const content = [
      "export function helper() {}",
      "export class Widget { render(): void {} }",
      "export interface IRepo { id: string }",
      "const config = { retries: 3 };",
    ].join("\n");
    const result = scanner.scanFile("src/module.ts", content);
    expect(result?.symbols).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "helper", kind: "function" }),
      expect.objectContaining({ name: "Widget", kind: "class" }),
      expect.objectContaining({ name: "IRepo", kind: "interface" }),
      expect.objectContaining({ name: "config", kind: "variable" }),
    ]));
  });

  it("extracts class methods as method symbols", () => {
    const content = "class Service { private run(): number { return 1; } }";
    const result = scanner.scanFile("src/service.ts", content);
    expect(result?.symbols).toContainEqual(expect.objectContaining({ name: "run", kind: "method" }));
  });

  it("records start/end lines and a one-line signature", () => {
    const content = "export function big(\n  a: number\n): string {\n  return \"x\";\n}";
    const result = scanner.scanFile("src/big.ts", content);
    const fn = result?.symbols.find((s) => s.name === "big");
    expect(fn?.startLine).toBe(1);
    expect(fn?.endLine).toBe(5);
    expect(fn?.signature).toBe("export function big(");
  });

  it("extracts named, default, and namespace imports", () => {
    const content = [
      "import { foo, bar } from './utils';",
      "import React from 'react';",
      "import * as path from 'path';",
    ].join("\n");
    const result = scanner.scanFile("src/main.ts", content);
    expect(result?.imports).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "./utils", names: ["foo", "bar"], importType: "named" }),
      expect.objectContaining({ source: "react", names: ["React"], importType: "default" }),
      expect.objectContaining({ source: "path", names: ["path"], importType: "namespace" }),
    ]));
  });

  it("extracts exports including default functions", () => {
    const content = "export default function main() {}\nexport class Klass {}";
    const result = scanner.scanFile("src/exp.ts", content);
    expect(result?.exports).toContainEqual(
      expect.objectContaining({ name: "main", kind: "function", isDefault: true })
    );
    expect(result?.exports).toContainEqual(
      expect.objectContaining({ name: "Klass", kind: "class", isDefault: false })
    );
  });

  it("extracts exported variables", () => {
    const result = scanner.scanFile("src/vars.ts", "export const a = 1;\nexport let b = 2;");
    expect(result?.exports).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "a", kind: "variable" }),
      expect.objectContaining({ name: "b", kind: "variable" }),
    ]));
  });

  it("detects language from file extension", () => {
    expect(scanner.scanFile("a.ts", "const x = 1;")?.language).toBe("typescript");
    expect(scanner.scanFile("a.tsx", "const x = 1;")?.language).toBe("typescript");
    expect(scanner.scanFile("a.js", "const x = 1;")?.language).toBe("javascript");
    expect(scanner.scanFile("a.kt", "val x = 1")?.language).toBe("kotlin");
    expect(scanner.scanFile("a.py", "x = 1")?.language).toBe("python");
  });

  it("returns null for unsupported file extensions", () => {
    expect(scanner.scanFile("README.md", "# Title")).toBeNull();
    expect(scanner.scanFile("script.sh", "echo hi")).toBeNull();
  });

  it("includes a valid SHA-256 hash in the payload", () => {
    const result = scanner.scanFile("a.ts", "const x = 1;");
    expect(result?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces empty arrays when the file has no imports or exports", () => {
    const result = scanner.scanFile("a.ts", "const local = 1;");
    expect(result?.imports).toEqual([]);
    expect(result?.exports).toEqual([]);
  });
});