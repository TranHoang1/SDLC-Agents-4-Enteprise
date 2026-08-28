# Software Test Cases (STC)

## SDLC-Agents-4-Enterprise code-intel indexer — SA4E-225: Incomplete language support — Scala, C/C++, C#, Ruby, PHP, Swift, Bash, PowerShell lack parser/regex patterns for symbol extraction

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-225 |
| Title | Incomplete language support: Scala, C/C++, C#, Ruby, PHP, Swift, Bash, PowerShell lack parser/regex patterns for symbol extraction |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-28 |
| Status | Draft |
| Related STP | documents/SA4E-225/STP.md |
| Related FSD | documents/SA4E-225/FSD.md (v1.1) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-28 | QA Agent | Initiate document — derived from FSD use cases, BRD stories, TDD §11/§12, and security conditions C1/C2/C4 |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Per-language extraction (Happy Path) | TC-001 to TC-009 | 9 | High/Medium |
| Integration — `.ps1` indexing | TC-010 | 1 | Medium |
| Regression — existing tree-sitter languages | TC-011 | 1 | High |
| Security — ReDoS regression (C1) | TC-012 | 1 | High |
| Security — size guard (C2) | TC-013 | 1 | Medium |
| Security — Swift spacing (C4) | TC-014 | 1 | Medium |
| Maintainability — file size ≤200 lines (AC-5) | TC-015 | 1 | Medium |

> All test cases are automated (vitest). The recommended location is `backend/src/engine/parsers/__tests__/signature-extractor.test.ts` extended, or new per-language files under `backend/src/engine/parsers/languages/__tests__/`. Each test calls the engine API `extractSymbols(content, language)` (signature-extractor.ts) and asserts the set of distinct `SymbolKind` values, except TC-010 (config/routing) and TC-015 (static line-count).

---

## 1. Functional Test Cases — Per-Language Extraction

### TC-001: Scala symbol extraction (object, trait, case class, sealed class, def, val)

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High (MUST) |
| **Type** | Functional |
| **Requirement** | BRD Story 1 AC1-3; FSD UC-1, BR-1..BR-5 |
| **Preconditions** | `SCALA_PATTERNS` registered in `getPatterns('scala')`; test imports `extractSymbols` from signature-extractor.ts |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `extractSymbols(<Scala sample>, 'scala')` | Returns `ExtractedSymbol[]` |
| 2 | Collect distinct `kind` values from the result | Distinct kinds ⊇ {module, trait, class, function, constant, variable} (≥5 distinct) |
| 3 | Assert specific names are present | `MyObj`(module), `Animal`(trait), `Cat`(class), `Base`(class), `greet`(function), `answer`(constant), `counter`(variable) all present |

**Test Data (real Scala sample):**
```
package com.ex
object MyObj {
  trait Animal
  case class Cat(name: String)
  sealed class Base
  def greet(): Unit = {}
  val answer = 42
  var counter = 0
}
```
**Postconditions:** Scala-specific symbols present; verifies AC-1 (object, trait, case class, sealed class, def, val all detected).

---

### TC-002: C symbol extraction

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High (HIGH) |
| **Type** | Functional |
| **Requirement** | BRD Story 2; FSD BR-6, BR-9, BR-10 |
| **Preconditions** | `C_PATTERNS` registered for `'c'` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<C sample>, 'c')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {struct, enum, type, function, constant, variable} (≥5) |
| 3 | Assert names | `Point`(struct), `Color`(enum), `size_t`(type), `MAX`(function), `VERSION`(constant), `globalVar`(variable) present |

**Test Data:**
```
struct Point { int x; int y; };
enum Color { RED, GREEN };
typedef unsigned long size_t;
#define MAX(a,b) ((a)>(b)?(a):(b))
#define VERSION 3
int globalVar = 5;
```
**Postconditions:** C extraction ≥5 kinds; function-like `#define`→function, object-like `#define`→constant (BR-10).

---

### TC-003: C++ symbol extraction

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High (HIGH) |
| **Type** | Functional |
| **Requirement** | BRD Story 2; FSD BR-7, BR-9 |
| **Preconditions** | `CPP_PATTERNS` registered for `'cpp'` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<C++ sample>, 'cpp')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {namespace, class, struct, function, enum, type} (≥5) |
| 3 | Assert names | `myns`(namespace), `Widget`(class), `Point`(struct), `add`(function), `Status`(enum), `IntVec`(type) present |

**Test Data:**
```
namespace myns {
class Widget { };
struct Point { };
int add(int a, int b);
enum Status { OK, ERR };
using IntVec = std::vector<int>;
}
template<typename T> class Container { };
```
**Postconditions:** C++ extraction ≥5 kinds (template class `Container`→class included).

---

### TC-004: C# symbol extraction

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High (HIGH) |
| **Type** | Functional |
| **Requirement** | BRD Story 2; FSD BR-8, BR-9, BR-11 |
| **Preconditions** | `CSHARP_PATTERNS` registered for `'csharp'`; modifier/attribute prefix prepended |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<C# sample>, 'csharp')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {class, interface, struct, enum, type, method, variable} (≥5, actually 7) |
| 3 | Assert names | `Calculator`(class), `IShape`(interface), `Point`(struct), `Color`(enum), `Handler`(type/delegate), `Compute`(method), `Value`(variable), `Clicked`(variable) present |

**Test Data:**
```
public class Calculator { }
public interface IShape { }
public struct Point { }
public enum Color { Red, Green }
public delegate void Handler();
public void Compute() { }
public int Value { get; set; }
public event EventHandler Clicked;
```
**Postconditions:** C# extraction ≥5 kinds; `using` directives / `[Attribute]` not extracted as symbols (BR-11).

---

### TC-005: Ruby symbol extraction

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BRD Story 3; FSD BR-12, BR-17 |
| **Preconditions** | `RUBY_PATTERNS` registered for `'ruby'` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<Ruby sample>, 'ruby')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {class, module, function, constant, variable} (≥5) |
| 3 | Assert names | `User`(class), `Helper`(module), `greet`(function), `CONSTANT`(constant), `@name`/`$global`/`age`(variable) present |

**Test Data:**
```
class User
  module Helper
    def greet
    end
    CONSTANT = 10
    @name = "x"
    $global = 1
    attr_accessor :age
  end
end
```
**Postconditions:** Ruby extraction ≥5 kinds.

---

### TC-006: PHP symbol extraction

| Field | Value |
|-------|-------|
| **ID** | TC-006 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BRD Story 3; FSD BR-13, BR-17 |
| **Preconditions** | `PHP_PATTERNS` registered for `'php'`; method pattern before function pattern |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<PHP sample>, 'php')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {namespace, class, interface, trait, method, function} (≥5) |
| 3 | Assert names | `App\Model`(namespace), `User`(class), `Repository`(interface), `Timestamps`(trait), `make`(method), `helper`(function), `Base`(class) present |

**Test Data:**
```
<?php
namespace App\Model;
class User { }
interface Repository { }
trait Timestamps { }
public function make() { }
function helper() { }
abstract class Base { }
```
**Postconditions:** PHP extraction ≥5 kinds.

---

### TC-007: Swift symbol extraction

| Field | Value |
|-------|-------|
| **ID** | TC-007 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BRD Story 3; FSD BR-14, BR-17; Security C4 |
| **Preconditions** | `SWIFT_PATTERNS` registered for `'swift'`; modifier group uses `\s+` (see TC-014) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<Swift sample>, 'swift')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {class, struct, interface, enum, function, variable} (≥5) |
| 3 | Assert names | `Foo`(class), `Bar`(struct), `Baz`(interface), `Dir`(enum), `run`(function), `Qux`(class via extension), `ActorX`(class via actor), `count`(variable) present |

**Test Data:**
```
public class Foo { }
struct Bar { }
protocol Baz { }
enum Dir { case up }
func run() { }
extension Qux { }
actor ActorX { }
var count = 0
```
**Postconditions:** Swift extraction ≥5 kinds. Also validates C4 pair `public class Foo` (overlaps TC-014).

---

### TC-008: Bash symbol extraction (deviated ≥3)

| Field | Value |
|-------|-------|
| **ID** | TC-008 |
| **Priority** | Medium |
| **Type** | Functional (deviation) |
| **Requirement** | BRD Story 3 (deviated); FSD BR-15, BR-17, BR-19; TDD §12 (Bash ≥3) |
| **Preconditions** | `BASH_PATTERNS` registered for `'bash'`; both function syntaxes handled |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<Bash sample>, 'bash')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {function, variable, constant} (≥3 — approved deviation, not ≥5) |
| 3 | Assert names & both syntaxes | `deploy`(function via `function name()`), `start`(function via `name() {}`), `NAME`(variable), `tmp`(variable), `MAX`(constant) present |

**Test Data:**
```
function deploy() { echo hi; }
start() { echo go; }
export NAME="x"
readonly MAX=10
local tmp=1
```
**Postconditions:** Bash extraction ≥3 distinct kinds (documented AC deviation — Bash cannot reach 5 with closed `SymbolKind` union).

---

### TC-009: PowerShell symbol extraction (deviated ≥4)

| Field | Value |
|-------|-------|
| **ID** | TC-009 |
| **Priority** | Medium |
| **Type** | Functional (deviation) |
| **Requirement** | BRD Story 3 (deviated); FSD BR-16, BR-17, BR-18; TDD §12 (PowerShell ≥4) |
| **Preconditions** | `POWERSHELL_PATTERNS` registered for `'powershell'`; Verb-Noun heuristic enforced |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols(<PowerShell sample>, 'powershell')` | Returns symbols |
| 2 | Collect distinct kinds | ⊇ {function, class, variable, constant} (≥4 — approved deviation, not ≥5) |
| 3 | Assert names | `Get-Data`(function, Verb-Noun PascalCase), `Person`(class), `config`(variable), `Path`(variable via param), `Max`(constant via Set-Variable -Option Constant) present |

**Test Data:**
```
function Get-Data { param($Path) }
class Person { [string]$Name }
$config = @{}
Set-Variable -Name Max -Option Constant
```
**Postconditions:** PowerShell extraction ≥4 distinct kinds (documented AC deviation).

---

## 2. Integration Test — `.ps1` Indexing

### TC-010: PowerShell `.ps1` files are no longer skipped (DEFAULT_EXTENSIONS + FALLBACK_EXTENSIONS)

| Field | Value |
|-------|-------|
| **ID** | TC-010 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | BRD Story 4 AC1-2; FSD UC-4, BR-20..BR-21; TDD §5.5/§5.6 |
| **Preconditions** | `config/index.ts` `DEFAULT_EXTENSIONS` and `resolver.ts` `FALLBACK_EXTENSIONS` are importable from the test; `POWERSHELL_PATTERNS` present (ships with TC-009) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Import `DEFAULT_EXTENSIONS` and assert it contains `'.ps1'` | `'.ps1'` ∈ `DEFAULT_EXTENSIONS` |
| 2 | Import `FALLBACK_EXTENSIONS` (resolver.ts) and assert it contains `'.ps1'` | `'.ps1'` ∈ `FALLBACK_EXTENSIONS` |
| 3 | Simulate the indexer gate: a `.ps1` file path passes the `DEFAULT_EXTENSIONS` check (i.e., is NOT skipped) | File is included, not skipped |
| 4 | Feed a PowerShell sample to `extractSymbols(sample, 'powershell')` | Returns ≥4 distinct kinds (proves the routed language yields real extraction) |

**Test Data:** PowerShell sample from TC-009 (`Get-Data`, `Person`, `$config`, `Set-Variable -Name Max`).

**Postconditions:** `.ps1` is indexed end-to-end; AC-3 satisfied. (If `.ps1` is added but `POWERSHELL_PATTERNS` absent, extraction would be GENERIC — TC-009 prevents that regression.)

---

## 3. Regression Test

### TC-011: No regression — existing tree-sitter languages unaffected + existing suite green

| Field | Value |
|-------|-------|
| **ID** | TC-011 |
| **Priority** | High (MUST) |
| **Type** | Regression |
| **Requirement** | BRD Story 5 AC1-3; FSD BR-22..BR-25; TDD §12 |
| **Preconditions** | Full `backend` `vitest` suite runnable; 9 fully-supported languages recognized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run the full existing `vitest` suite (`npx vitest run` from `backend/`) | 0 test failures across `signature-extractor.test.ts`, `languages/__tests__/*`, and all parser tests |
| 2 | For each existing language id (`typescript`,`javascript`,`python`,`kotlin`,`java`,`go`,`rust`,`apex`,`pega`) call `extractSymbols` on a curated sample and assert previously-validated kinds | Each returns its expected kind set (e.g., TS → class+function; python → class+function; go → func+struct+interface; etc.) |
| 3 | Confirm the 7 relocated `PatternDef[]` consts (builtin) still resolve via `getPatterns` | No silent re-routing to `GENERIC_PATTERNS` for these 9 languages |

**Test Data:** Curated minimal samples per existing language (reuse existing fixtures in `languages/__tests__/fixtures/`).

**Postconditions:** No behavioral change for the 9 tree-sitter languages; AC-4 satisfied.

---

## 4. Security Test Cases

### TC-012: ReDoS regression — degenerate long-line input per language (CI gate, C1)

| Field | Value |
|-------|-------|
| **ID** | TC-012 |
| **Priority** | High (C1 — mandatory CI gate) |
| **Type** | Security (Non-Functional / Performance) |
| **Requirement** | Security condition C1; TDD §7, §12; FSD R1 |
| **Preconditions** | All 9 new `PatternDef[]` sets + relocated builtins registered; test can build a very long single-line string |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | For each new language id (`scala`,`c`,`cpp`,`csharp`,`ruby`,`php`,`swift`,`bash`,`powershell`), build a degenerate long line that maximizes backtracking pressure for that language's free-function/pattern (e.g., C#: `'a'.repeat(100000) + '('`). | String built |
| 2 | Call `extractSymbols(degenerateInput, lang)` and measure wall-clock time | Completes and returns (no hang); elapsed time bounded (e.g., < 1000 ms per language on CI) |
| 3 | Assert no exception thrown and process does not exceed a memory/time budget | Test passes; if it hangs/explodes → Critical defect (ReDoS) |

**Test Data:** 100,000-char single-line inputs per language, especially the C# free-function pattern `(?!if|for|...)\w[\w<>\[\],\s\.\?]*\s+(\w+)\s*\(`.

**Postconditions:** New regexes are ReDoS-safe (linear). This is a **mandatory CI gate** — failure blocks merge.

---

### TC-013: Per-line / file size guard before `matchAll` (C2)

| Field | Value |
|-------|-------|
| **ID** | TC-013 |
| **Priority** | Medium (C2 — recommended) |
| **Type** | Security / Non-Functional |
| **Requirement** | Security condition C2; TDD §7 |
| **Preconditions** | `extractSymbols` / `extractWithPattern` implementation reviewed for a size guard before `content.matchAll` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Build a 5 MB single-line string (no newlines) containing a pattern that could otherwise trigger expensive matching | String built |
| 2 | Call `extractSymbols(hugeLine, 'csharp')` and measure wall-clock time | Completes within a bounded time (e.g., < 2000 ms) |
| 3 | Assert the implementation includes a per-line/file size guard (verified by the bounded time AND, if feasible, by a static check or a documented code comment marking the guard) | Guard present; if extraction is unbounded/slow, the test fails indicating the guard is missing |

**Test Data:** ~5,000,000-char single-line string (e.g., `'x'.repeat(5_000_000)` with an embedded `(` near the end).

**Postconditions:** A size guard exists before `matchAll`; protects against pathological large lines (reinforces C1).

---

### TC-014: Swift modifier group uses `\s+` so `public class Foo` matches (C4)

| Field | Value |
|-------|-------|
| **ID** | TC-014 |
| **Priority** | Medium (C4 — recommended) |
| **Type** | Security / Correctness |
| **Requirement** | Security condition C4 |
| **Preconditions** | `SWIFT_PATTERNS` class/struct modifier group prepends modifiers with `\s+` between modifier and keyword |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractSymbols("public class Foo { }", 'swift')` | Returns a `class` symbol named `Foo` |
| 2 | `extractSymbols("private struct Bar { }", 'swift')` | Returns a `struct` symbol named `Bar` |
| 3 | `extractSymbols("open func baz() { }", 'swift')` | Returns a `function` symbol named `baz` |
| 4 | Negative: `extractSymbols("publicclass Foo { }", 'swift')` (no space) | Does NOT falsely match (modifier requires `\s+`) — only the spaced form matches |

**Test Data:** Inline Swift snippets above.

**Postconditions:** Swift modifier group uses `\s+`; `public class Foo` (with space) is correctly detected — eliminates the false-negative risk flagged by C4.

---

## 5. Maintainability Test

### TC-015: Source file ≤ 200 lines compliance (AC-5)

| Field | Value |
|-------|-------|
| **ID** | TC-015 |
| **Priority** | Medium |
| **Type** | Maintainability / Static |
| **Requirement** | BRD Story 5 / BR-24; TDD §5.1, §14.1 |
| **Preconditions** | Test can read source files from `backend/src/engine/parsers/` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | For each changed file (`signature-extractor.ts`, `tree-sitter-indexer.ts`, `config/index.ts`, `resolver.ts`) and each new `languages/*.ts` pattern file, read line count | All ≤ 200 lines, OR if a file legitimately exceeds 200 it has been split per-language per TDD §5.1 |
| 2 | Specifically assert `signature-extractor.ts` post-refactor is ~115 lines (engine-only) | ≤ 200 and compliant |
| 3 | Assert each `languages/scala.ts` … `languages/powershell.ts` is ≤ 200 lines | Compliant |

**Test Data:** Filesystem paths under `backend/src/engine/parsers/` (resolved at test time).

**Postconditions:** Maintainability rule satisfied; AC-5 covered.

---

## 6. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-1 Scala extraction | FSD 3.1 | TC-001 | Covered |
| BR-1..BR-5 Scala rules | FSD 3.1.3 | TC-001 | Covered |
| UC-2 C/C++/C# extraction | FSD 3.2 | TC-002, TC-003, TC-004 | Covered |
| BR-6..BR-11 C/C++/C# rules | FSD 3.2.3 | TC-002, TC-003, TC-004 | Covered |
| UC-3 Ruby/PHP/Swift/Bash/PowerShell | FSD 3.3 | TC-005, TC-006, TC-007, TC-008, TC-009 | Covered |
| BR-12..BR-19 scripting rules | FSD 3.3.2 | TC-005..TC-009 | Covered |
| UC-4 `.ps1` indexing | FSD 3.4 | TC-010 | Covered |
| BR-20..BR-21 `.ps1` rules | FSD 3.4.3 | TC-010 | Covered |
| UC-5 No regression & maintainability | FSD 3.5 | TC-011, TC-015 | Covered |
| BR-22..BR-25 regression rules | FSD 3.5.1 | TC-011, TC-015 | Covered |
| AC-1 Scala specific constructs | BRD Story 1 | TC-001 | Covered |
| AC-2 ≥5 kinds (Bash≥3, PowerShell≥4 deviation) | BRD Story 2/3 | TC-001..TC-009 | Covered |
| AC-3 `.ps1` indexed | BRD Story 4 | TC-010 | Covered |
| AC-4 No regression | BRD Story 5 | TC-011 | Covered |
| AC-5 ≤200 lines | BRD Story 5 | TC-015 | Covered |
| C1 ReDoS regression | SECURITY (task) | TC-012 | Covered (CI gate) |
| C2 Size guard before matchAll | SECURITY (task) | TC-013 | Covered |
| C4 Swift `\s+` spacing | SECURITY (task) | TC-014 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 5 | 5 | 100% |
| Business Rules | 25 | 25 | 100% |
| Acceptance Criteria | 5 | 5 | 100% |
| Security Conditions | 3 | 3 | 100% |
| **Overall** | **38** | **38** | **100%** |

---

## 7. Appendix

### Test Data Setup

- Per-language fixtures are inlined in each test case above (§1–§5). Devs MAY persist them as files under `backend/src/engine/parsers/languages/__tests__/fixtures/` for reuse.
- Degenerate/large inputs for TC-012/TC-013 are generated dynamically in-test (no fixture file needed).

### Environment Configuration

- Run from `backend/`: `npx vitest run` (or `npm test`).
- No external service, DB, or browser required.
- ReDoS (TC-012) should run in CI with a per-test timeout (e.g., 5 s) so a hang fails fast.
