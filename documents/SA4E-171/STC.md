# System Test Cases (STC)

## Code Intelligence Platform — SA4E-171: Migrate Pega Rules from knowledge_entries to symbols table

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-171 |
| Title | Migrate Pega Rules from knowledge_entries to symbols table |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Status | Draft |
| Related STP | STP-v1-SA4E-171.docx |

---

## 1. PBT — Property-Based Tests (fast-check)

### PBT-01: resolveSymbolKind always returns pega_ prefixed string

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-01 |
| **Title** | resolveSymbolKind always returns string starting with 'pega_' |
| **Level** | PBT |
| **UC/BR** | UC-01, BR-01 |
| **Priority** | High |
| **Iterations** | 10,000 |

**Property:** For any non-empty string input, `resolveSymbolKind(input)` returns a string starting with `'pega_'` and length > 5.

**Generator:** `fc.string({ minLength: 1, maxLength: 100 })`

```typescript
it.prop([fc.string({ minLength: 1, maxLength: 100 })], { numRuns: 10000 })(
  'resolveSymbolKind always returns pega_ prefixed string',
  (pxObjClass) => {
    const result = resolveSymbolKind(pxObjClass);
    expect(result).toMatch(/^pega_/);
    expect(result.length).toBeGreaterThan(5);
  }
);
```

---

### PBT-02: resolveSymbolKind is deterministic

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-02 |
| **Title** | resolveSymbolKind returns same result for same input |
| **Level** | PBT |
| **UC/BR** | UC-01, BR-01 |
| **Priority** | High |
| **Iterations** | 10,000 |

**Property:** `resolveSymbolKind(x) === resolveSymbolKind(x)` for all x.

```typescript
it.prop([fc.string({ minLength: 1, maxLength: 200 })], { numRuns: 10000 })(
  'resolveSymbolKind is deterministic',
  (input) => {
    expect(resolveSymbolKind(input)).toBe(resolveSymbolKind(input));
  }
);
```

---

### PBT-03: buildVirtualPath produces valid pega:// URI

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-03 |
| **Title** | buildVirtualPath always produces pega:// URI with 3 path segments |
| **Level** | PBT |
| **UC/BR** | UC-01, BR-02 |
| **Priority** | High |
| **Iterations** | 10,000 |

**Property:** Result matches `pega://{class}/{type}/{name}` and ruleType does not contain 'pega_'.

```typescript
it.prop([
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{0,50}$/),
  fc.constantFrom('pega_activity','pega_flow','pega_data_transform','pega_decision_table','pega_section','pega_harness','pega_report','pega_connector','pega_unknown'),
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{0,50}$/)
], { numRuns: 10000 })(
  'buildVirtualPath produces valid pega:// URI',
  (className, kind, ruleName) => {
    const result = buildVirtualPath(className, kind, ruleName);
    expect(result).toMatch(/^pega:\/\/.+\/.+\/.+$/);
    expect(result).not.toContain('pega_');
    expect(result.startsWith(`pega://${className}/`)).toBe(true);
  }
);
```

---

### PBT-04: buildFqn is injective

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-04 |
| **Title** | buildFqn produces unique FQN for different input tuples |
| **Level** | PBT |
| **UC/BR** | UC-01, BR-03 |
| **Priority** | Medium |
| **Iterations** | 5,000 |

**Property:** If `(a1,b1,c1) !== (a2,b2,c2)` then `buildFqn(a1,b1,c1) !== buildFqn(a2,b2,c2)`.

```typescript
it.prop([
  fc.tuple(fc.string({minLength:1,maxLength:30}), fc.string({minLength:1,maxLength:30}), fc.string({minLength:1,maxLength:30})),
  fc.tuple(fc.string({minLength:1,maxLength:30}), fc.string({minLength:1,maxLength:30}), fc.string({minLength:1,maxLength:30}))
], { numRuns: 5000 })(
  'buildFqn is injective for distinct inputs',
  ([a1,b1,c1], [a2,b2,c2]) => {
    fc.pre(a1 !== a2 || b1 !== b2 || c1 !== c2);
    expect(buildFqn(a1,b1,c1)).not.toBe(buildFqn(a2,b2,c2));
  }
);
```

---

### PBT-05: isPegaKind consistent with pega_ prefix

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-05 |
| **Title** | isPegaKind(s) === s.startsWith('pega_') for all strings |
| **Level** | PBT |
| **UC/BR** | UC-02, BR-08 |
| **Priority** | High |
| **Iterations** | 10,000 |

```typescript
it.prop([fc.string({ minLength: 0, maxLength: 50 })], { numRuns: 10000 })(
  'isPegaKind matches startsWith pega_',
  (s) => { expect(isPegaKind(s)).toBe(s.startsWith('pega_')); }
);
```

---

### PBT-06: selectStrategy returns PEGA_SUMMARY for pega_* + workspaceType='pega'

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-06 |
| **Title** | selectStrategy always returns PEGA_SUMMARY for pega_ kinds with pega workspace |
| **Level** | PBT |
| **UC/BR** | UC-02, BR-09 |
| **Priority** | High |
| **Iterations** | 10,000 |

```typescript
it.prop([fc.string({minLength:1,maxLength:30}).map(s => 'pega_' + s)], { numRuns: 10000 })(
  'PEGA_SUMMARY for all pega_ kinds',
  (kind) => { expect(selectStrategy(kind, 'pega')).toBe('PEGA_SUMMARY'); }
);
```

---

### PBT-07: mergeDedupResults count ≤ sum of inputs

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-07 |
| **Title** | Merged results never exceed sum of input arrays (capped by limit) |
| **Level** | PBT |
| **UC/BR** | UC-04, BR-21 |
| **Priority** | Medium |
| **Iterations** | 5,000 |

```typescript
it.prop([
  fc.array(fc.record({ source: fc.string(), score: fc.float({min:0,max:1}) }), {maxLength:20}),
  fc.array(fc.record({ source: fc.string(), score: fc.float({min:0,max:1}) }), {maxLength:20}),
  fc.integer({min:1,max:50})
], { numRuns: 5000 })(
  'merge count <= min(sum, limit)',
  (legacy, symbols, limit) => {
    const result = mergeDedupResults(legacy, symbols, limit);
    expect(result.length).toBeLessThanOrEqual(Math.min(legacy.length + symbols.length, limit));
  }
);
```

---

### PBT-08: mergeDedupResults prefers symbols for same FQN

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-08 |
| **Title** | For same FQN in both, result comes from symbols |
| **Level** | PBT |
| **UC/BR** | UC-04, BR-22 |
| **Priority** | High |
| **Iterations** | 5,000 |

```typescript
it.prop([fc.string({minLength:1,maxLength:30})], { numRuns: 5000 })(
  'prefers symbols result for duplicate FQN',
  (fqn) => {
    const legacy = [{ source: fqn, score: 0.9, matchSource: 'knowledge_fts' }];
    const symbols = [{ source: fqn, score: 0.5, matchSource: 'symbols_fts' }];
    const result = mergeDedupResults(legacy, symbols, 10);
    expect(result.length).toBe(1);
    expect(result[0].matchSource).toBe('symbols_fts');
  }
);
```

---

### PBT-09: FTS sanitization strips all special characters

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-09 |
| **Title** | sanitizeFtsQuery output contains only word chars and spaces |
| **Level** | PBT |
| **UC/BR** | SEC-F1 |
| **Priority** | High |
| **Iterations** | 10,000 |

```typescript
it.prop([fc.string({ minLength: 0, maxLength: 500 })], { numRuns: 10000 })(
  'sanitizeFtsQuery output has no special chars',
  (input) => {
    const result = sanitizeFtsQuery(input);
    expect(result).toMatch(/^[\w\s*]*$|^\*$/);
  }
);
```

---

### PBT-10: FTS sanitization never returns empty

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-10 |
| **Title** | sanitizeFtsQuery always returns non-empty (fallback to '*') |
| **Level** | PBT |
| **UC/BR** | SEC-F1 |
| **Priority** | High |
| **Iterations** | 10,000 |

```typescript
it.prop([fc.string({ minLength: 0, maxLength: 1000 })], { numRuns: 10000 })(
  'sanitizeFtsQuery never empty',
  (input) => { expect(sanitizeFtsQuery(input).length).toBeGreaterThan(0); }
);
```

---

### PBT-11: Query length capped at 200 chars

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-11 |
| **Title** | sanitizeFtsQuery output ≤ 200 characters |
| **Level** | PBT |
| **UC/BR** | SEC-F2 |
| **Priority** | High |
| **Iterations** | 10,000 |

```typescript
it.prop([fc.string({ minLength: 0, maxLength: 10000 })], { numRuns: 10000 })(
  'output length <= 200',
  (input) => { expect(sanitizeFtsQuery(input).length).toBeLessThanOrEqual(200); }
);
```

---

### PBT-12: syncRuleToSymbols rejects >5MB rules

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-12 |
| **Title** | Rules exceeding 5MB return null from syncRuleToSymbols |
| **Level** | PBT |
| **UC/BR** | SEC-F4 |
| **Priority** | Medium |
| **Iterations** | 100 |

```typescript
it.prop([fc.integer({min: 5*1024*1024 + 1, max: 6*1024*1024})], { numRuns: 100 })(
  'rejects oversized rules',
  async (size) => {
    const rule = { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyRuleName: 'Big', data: 'x'.repeat(size) };
    const result = await syncRuleToSymbols(mockAdapter, rule, 'proj', '');
    expect(result).toBeNull();
  }
);
```

---

## 2. UT — Unit Tests

### UT-01: resolveSymbolKind — Rule-Obj-Activity → pega_activity

| Attribute | Value |
|-----------|-------|
| **ID** | UT-01 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-01 |
| **Priority** | High |
| **Input** | `resolveSymbolKind('Rule-Obj-Activity')` |
| **Expected** | `'pega_activity'` |
| **Test Data** | pega-mapping-inputs.csv row 1 |

---

### UT-02: resolveSymbolKind — Rule-Obj-Flow → pega_flow

| Attribute | Value |
|-----------|-------|
| **ID** | UT-02 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-01 |
| **Priority** | High |
| **Input** | `resolveSymbolKind('Rule-Obj-Flow')` |
| **Expected** | `'pega_flow'` |
| **Test Data** | pega-mapping-inputs.csv row 2 |

---

### UT-03: resolveSymbolKind — Rule-Obj-DataTransform → pega_data_transform

| Attribute | Value |
|-----------|-------|
| **ID** | UT-03 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-01 |
| **Priority** | High |
| **Input** | `resolveSymbolKind('Rule-Obj-DataTransform')` |
| **Expected** | `'pega_data_transform'` |
| **Test Data** | pega-mapping-inputs.csv row 3 |

---

### UT-04: resolveSymbolKind — Unknown → pega_unknown

| Attribute | Value |
|-----------|-------|
| **ID** | UT-04 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-01, AF-01 |
| **Priority** | High |
| **Input** | `resolveSymbolKind('Rule-Obj-CustomWidget')` |
| **Expected** | `'pega_unknown'` |
| **Test Data** | pega-mapping-inputs.csv row 17 |

---

### UT-05: resolveSymbolKind — Rule-Connect-* → pega_connector

| Attribute | Value |
|-----------|-------|
| **ID** | UT-05 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-01 |
| **Priority** | High |
| **Input** | `resolveSymbolKind('Rule-Connect-HTTP')`, `resolveSymbolKind('Rule-Connect-SOAP')` |
| **Expected** | Both return `'pega_connector'` |
| **Test Data** | pega-mapping-inputs.csv rows 18-19 |

---

### UT-06: buildVirtualPath — correct format

| Attribute | Value |
|-----------|-------|
| **ID** | UT-06 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-02 |
| **Priority** | High |
| **Input** | `buildVirtualPath('Work-HR', 'pega_activity', 'ApproveLeave')` |
| **Expected** | `'pega://Work-HR/activity/ApproveLeave'` |

---

### UT-07: buildVirtualPath — strips pega_ prefix from kind

| Attribute | Value |
|-----------|-------|
| **ID** | UT-07 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-02 |
| **Priority** | Medium |
| **Input** | `buildVirtualPath('Finance', 'pega_decision_table', 'TaxCalc')` |
| **Expected** | `'pega://Finance/decision_table/TaxCalc'` |

---

### UT-08: buildFqn — correct format

| Attribute | Value |
|-----------|-------|
| **ID** | UT-08 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-03 |
| **Priority** | High |
| **Input** | `buildFqn('Rule-Obj-Activity', 'Work-HR', 'ApproveLeave')` |
| **Expected** | `'Rule-Obj-Activity:Work-HR:ApproveLeave'` |

---

### UT-09: buildFqn — special characters preserved

| Attribute | Value |
|-----------|-------|
| **ID** | UT-09 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-03 |
| **Priority** | Medium |
| **Input** | `buildFqn('Rule-Obj-Flow', 'My-App.Sub', 'Process-V2')` |
| **Expected** | `'Rule-Obj-Flow:My-App.Sub:Process-V2'` |

---

### UT-10: content_hash = SHA-256

| Attribute | Value |
|-----------|-------|
| **ID** | UT-10 |
| **Level** | UT |
| **UC/BR** | UC-01, BR-06 |
| **Priority** | High |
| **Input** | Known JSON string |
| **Expected** | SHA-256 hash matches `crypto.createHash('sha256').update(json).digest('hex')` |

---

### UT-11: isPegaKind — all 16 known kinds

| Attribute | Value |
|-----------|-------|
| **ID** | UT-11 |
| **Level** | UT |
| **UC/BR** | UC-02, BR-08 |
| **Priority** | High |
| **Input** | Each of: pega_activity, pega_flow, pega_data_transform, pega_decision_table, pega_decision_tree, pega_section, pega_harness, pega_report, pega_map_value, pega_when, pega_declare_expression, pega_declare_page, pega_validate, pega_connector, pega_list_view, pega_property |
| **Expected** | All return `true` |
| **Test Data** | pega-mapping-inputs.csv (kind column) |

---

### UT-12: selectStrategy — PEGA_SUMMARY for pega_activity

| Attribute | Value |
|-----------|-------|
| **ID** | UT-12 |
| **Level** | UT |
| **UC/BR** | UC-02, BR-09 |
| **Priority** | High |
| **Input** | `selectStrategy('pega_activity', 'pega')` |
| **Expected** | `'PEGA_SUMMARY'` |

---

### UT-13: selectStrategy — non-PEGA for standard kinds

| Attribute | Value |
|-----------|-------|
| **ID** | UT-13 |
| **Level** | UT |
| **UC/BR** | UC-02, BR-09 |
| **Priority** | Medium |
| **Input** | `selectStrategy('function', 'standard')` |
| **Expected** | `'FUNCTION_SUMMARY'` |

---

### UT-14: Skip enrichment for COMPLETED

| Attribute | Value |
|-----------|-------|
| **ID** | UT-14 |
| **Level** | UT |
| **UC/BR** | UC-02, BR-07 |
| **Priority** | High |
| **Input** | Symbol with enrichment_status='COMPLETED' |
| **Expected** | shouldCreateTask() returns false |

---

### UT-15: workspaceType='pega' for pega kinds

| Attribute | Value |
|-----------|-------|
| **ID** | UT-15 |
| **Level** | UT |
| **UC/BR** | UC-02, BR-12 |
| **Priority** | High |
| **Input** | kind='pega_data_transform' |
| **Expected** | Payload has `workspaceType: 'pega'` |

---

### UT-16: Batch size defaults to 100

| Attribute | Value |
|-----------|-------|
| **ID** | UT-16 |
| **Level** | UT |
| **UC/BR** | UC-03, BR-15 |
| **Priority** | Medium |
| **Input** | CLI args: `[]` (no --batch-size) |
| **Expected** | Parsed batchSize = 100 |

---

### UT-17: Dedup key is signature + project_id

| Attribute | Value |
|-----------|-------|
| **ID** | UT-17 |
| **Level** | UT |
| **UC/BR** | UC-03, BR-18 |
| **Priority** | High |
| **Input** | Same FQN, different project_id |
| **Expected** | Both considered unique (not deduped) |

---

### UT-18: mergeDedupResults — prefer symbols

| Attribute | Value |
|-----------|-------|
| **ID** | UT-18 |
| **Level** | UT |
| **UC/BR** | UC-04, BR-22 |
| **Priority** | High |
| **Input** | legacy=[{source:'FQN1',score:0.9}], symbols=[{source:'FQN1',score:0.8}] |
| **Expected** | 1 result, matchSource='symbols_fts' |

---

### UT-19: mergeDedupResults — keep both when FQNs differ

| Attribute | Value |
|-----------|-------|
| **ID** | UT-19 |
| **Level** | UT |
| **UC/BR** | UC-04, BR-22 |
| **Priority** | High |
| **Input** | legacy=[{source:'FQN1'}], symbols=[{source:'FQN2'}] |
| **Expected** | 2 results |

---

### UT-20: mergeDedupResults — respects limit

| Attribute | Value |
|-----------|-------|
| **ID** | UT-20 |
| **Level** | UT |
| **UC/BR** | UC-04, BR-21 |
| **Priority** | Medium |
| **Input** | 10 total results, limit=3 |
| **Expected** | Exactly 3 results |

---

### UT-21: mergeDedupResults — sorted by score desc

| Attribute | Value |
|-----------|-------|
| **ID** | UT-21 |
| **Level** | UT |
| **UC/BR** | UC-04, BR-21 |
| **Priority** | Medium |
| **Input** | Results with scores [0.7, 0.9, 0.3, 0.8] |
| **Expected** | Sorted output: [0.9, 0.8, 0.7, 0.3] |

---

### UT-22: sanitizeFtsQuery strips colon

| Attribute | Value |
|-----------|-------|
| **ID** | UT-22 |
| **Level** | UT |
| **UC/BR** | SEC-F1 |
| **Priority** | High |
| **Input** | `'kind:pega_activity'` |
| **Expected** | `'kind pega_activity'` or stripped equivalent |

---

### UT-23: sanitizeFtsQuery strips unbalanced quotes

| Attribute | Value |
|-----------|-------|
| **ID** | UT-23 |
| **Level** | UT |
| **UC/BR** | SEC-F1 |
| **Priority** | High |
| **Input** | `'"unbalanced query'` |
| **Expected** | Quotes removed |

---

### UT-24: Query truncated to 200 chars

| Attribute | Value |
|-----------|-------|
| **ID** | UT-24 |
| **Level** | UT |
| **UC/BR** | SEC-F2 |
| **Priority** | High |
| **Input** | `'a'.repeat(1000)` |
| **Expected** | Output length ≤ 200 |

---

### UT-25: PEGA_DUAL_WRITE — 'FALSE' disables

| Attribute | Value |
|-----------|-------|
| **ID** | UT-25 |
| **Level** | UT |
| **UC/BR** | SEC-F3 |
| **Priority** | Medium |
| **Input** | `process.env.PEGA_DUAL_WRITE = 'FALSE'` |
| **Expected** | Flag = false |

---

### UT-26: PEGA_DUAL_WRITE — '0' disables

| Attribute | Value |
|-----------|-------|
| **ID** | UT-26 |
| **Level** | UT |
| **UC/BR** | SEC-F3 |
| **Priority** | Medium |
| **Input** | `process.env.PEGA_DUAL_WRITE = '0'` |
| **Expected** | Flag = false |

---

### UT-27: syncRuleToSymbols rejects >5MB

| Attribute | Value |
|-----------|-------|
| **ID** | UT-27 |
| **Level** | UT |
| **UC/BR** | SEC-F4 |
| **Priority** | Medium |
| **Input** | Rule with 6MB payload |
| **Expected** | Returns null |

---

### UT-28: isPegaKind — non-pega returns false

| Attribute | Value |
|-----------|-------|
| **ID** | UT-28 |
| **Level** | UT |
| **UC/BR** | UC-02, BR-08 |
| **Priority** | Medium |
| **Input** | 'function', 'class', '', 'PEGA_activity' |
| **Expected** | All return false |

---

## 3. IT — Integration Tests

### IT-01: syncRuleToSymbols creates file + symbol

| Attribute | Value |
|-----------|-------|
| **ID** | IT-01 |
| **Level** | IT |
| **UC/BR** | UC-01, BR-04, BR-05 |
| **Priority** | High |
| **Preconditions** | In-memory SQLite with full schema |
| **Steps** | 1. Call syncRuleToSymbols(adapter, validRule, 'proj_1', 'ctx') |
| | 2. Query files WHERE project_id='proj_1' |
| | 3. Query symbols WHERE project_id='proj_1' |
| **Expected** | files: language='pega', module=pyClassName; symbols: correct kind, parent_symbol=pyClassName |
| **Test Data** | pega-rules-small.csv row 1 |

---

### IT-02: parent_symbol set correctly

| Attribute | Value |
|-----------|-------|
| **ID** | IT-02 |
| **Level** | IT |
| **UC/BR** | UC-01, BR-04 |
| **Priority** | High |
| **Steps** | 1. Sync rule with pyClassName='Work-HR-Benefits' |
| | 2. Query symbols.parent_symbol |
| **Expected** | `parent_symbol = 'Work-HR-Benefits'` |

---

### IT-03: Virtual file attributes correct

| Attribute | Value |
|-----------|-------|
| **ID** | IT-03 |
| **Level** | IT |
| **UC/BR** | UC-01, BR-05 |
| **Priority** | High |
| **Steps** | 1. Sync rule; 2. Query files row |
| **Expected** | path='pega://...', language='pega', module=pyClassName, line_count=1 |

---

### IT-04: content_hash updated on change

| Attribute | Value |
|-----------|-------|
| **ID** | IT-04 |
| **Level** | IT |
| **UC/BR** | UC-01, BR-06 |
| **Priority** | High |
| **Steps** | 1. Sync rule v1; 2. Modify rule JSON; 3. Sync v2; 4. Compare content_hash |
| **Expected** | content_hash changed |

---

### IT-05: FTS trigger auto-indexes symbol

| Attribute | Value |
|-----------|-------|
| **ID** | IT-05 |
| **Level** | IT |
| **UC/BR** | UC-05, BR-26, BR-27 |
| **Priority** | High |
| **Steps** | 1. Insert symbol via syncRuleToSymbols; 2. Query `symbols_fts MATCH 'ApproveLeave'` |
| **Expected** | FTS returns inserted symbol |

---

### IT-06: FTS indexes all fields

| Attribute | Value |
|-----------|-------|
| **ID** | IT-06 |
| **Level** | IT |
| **UC/BR** | UC-05, BR-27 |
| **Priority** | High |
| **Steps** | 1. Insert symbol; 2. MATCH by name; 3. MATCH by signature; 4. MATCH by doc_comment; 5. MATCH by kind |
| **Expected** | All matches succeed |

---

### IT-07: No task for COMPLETED symbol

| Attribute | Value |
|-----------|-------|
| **ID** | IT-07 |
| **Level** | IT |
| **UC/BR** | UC-02, BR-07 |
| **Priority** | High |
| **Steps** | 1. Insert symbol with enrichment_status='COMPLETED'; 2. Run task creator |
| **Expected** | pending_tasks has no new CODE_ENRICHMENT task |

---

### IT-08: loadContext reads body_embeddings

| Attribute | Value |
|-----------|-------|
| **ID** | IT-08 |
| **Level** | IT |
| **UC/BR** | UC-02, BR-10 |
| **Priority** | High |
| **Steps** | 1. Sync rule (creates body_embeddings row); 2. Call loadContext(symbolId) |
| **Expected** | SymbolContext.bodyText contains rule JSON |

---

### IT-09: No TAG_ENRICHMENT for Pega

| Attribute | Value |
|-----------|-------|
| **ID** | IT-09 |
| **Level** | IT |
| **UC/BR** | UC-02, BR-11 |
| **Priority** | High |
| **Steps** | 1. Sync Pega rule; 2. Query pending_tasks WHERE task_type='TAG_ENRICHMENT' |
| **Expected** | No TAG_ENRICHMENT tasks |

---

### IT-10: CODE_ENRICHMENT payload has workspaceType='pega'

| Attribute | Value |
|-----------|-------|
| **ID** | IT-10 |
| **Level** | IT |
| **UC/BR** | UC-02, BR-12 |
| **Priority** | High |
| **Steps** | 1. Sync rule; 2. Query pending_tasks; 3. Parse payload |
| **Expected** | payload.workspaceType === 'pega' |

---

### IT-11: Migration idempotency

| Attribute | Value |
|-----------|-------|
| **ID** | IT-11 |
| **Level** | IT |
| **UC/BR** | UC-03, BR-14, BR-18 |
| **Priority** | High |
| **Steps** | 1. Insert 10 rules in knowledge_entries; 2. Run migration; 3. Run again |
| **Expected** | Run 2: migrated=0, skipped=10 |
| **Test Data** | pega-rules-migration.csv rows 1-10 |

---

### IT-12: Migration creates enrichment tasks

| Attribute | Value |
|-----------|-------|
| **ID** | IT-12 |
| **Level** | IT |
| **UC/BR** | UC-03, BR-19 |
| **Priority** | High |
| **Steps** | 1. Migrate 5 rules; 2. Count pending_tasks |
| **Expected** | 5 CODE_ENRICHMENT tasks created |

---

### IT-13: Configurable batch size

| Attribute | Value |
|-----------|-------|
| **ID** | IT-13 |
| **Level** | IT |
| **UC/BR** | UC-03, BR-15 |
| **Priority** | Medium |
| **Steps** | 1. Insert 25 rules; 2. Migrate with batchSize=10 |
| **Expected** | 3 transaction commits (10+10+5) |

---

### IT-14: Progress logging per batch

| Attribute | Value |
|-----------|-------|
| **ID** | IT-14 |
| **Level** | IT |
| **UC/BR** | UC-03, BR-17 |
| **Priority** | Medium |
| **Steps** | 1. Migrate 30 rules, batchSize=10; 2. Capture logs |
| **Expected** | 3 progress messages matching pattern |

---

### IT-15: Query length limit enforced in search

| Attribute | Value |
|-----------|-------|
| **ID** | IT-15 |
| **Level** | IT |
| **UC/BR** | SEC-F2 |
| **Priority** | High |
| **Steps** | 1. Search with 1000-char query; 2. Verify no error |
| **Expected** | Search completes, FTS query internally ≤200 chars |

---

### IT-16: >5MB rule rejected in live path

| Attribute | Value |
|-----------|-------|
| **ID** | IT-16 |
| **Level** | IT |
| **UC/BR** | SEC-F4 |
| **Priority** | Medium |
| **Steps** | 1. Create 6MB rule JSON; 2. syncRuleToSymbols; 3. Check DB |
| **Expected** | Returns null, no files/symbols rows |

---

### IT-17: Project_id isolation in dual-read

| Attribute | Value |
|-----------|-------|
| **ID** | IT-17 |
| **Level** | IT |
| **UC/BR** | SEC-04 |
| **Priority** | High |
| **Steps** | 1. Sync rule for proj_A; 2. Sync rule for proj_B; 3. Search with proj_A scope |
| **Expected** | Only proj_A result returned |

---

### IT-18: Archived entries excluded

| Attribute | Value |
|-----------|-------|
| **ID** | IT-18 |
| **Level** | IT |
| **UC/BR** | UC-04, BR-23 |
| **Priority** | High |
| **Steps** | 1. Insert knowledge_entry with archived=1; 2. Search |
| **Expected** | Archived not in results |

---

## 4. E2E-API — End-to-End API Tests

### E2E-API-01: mem_search returns Pega from symbols_fts

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-01 |
| **Level** | E2E-API |
| **UC/BR** | UC-04, BR-21 |
| **Priority** | High |
| **Preconditions** | Server running, Pega symbols indexed |
| **Steps** | 1. POST `tools/call` with `mem_search(query:"Activity ApproveLeave")` |
| | 2. Parse response |
| **Expected** | Result with kind='pega_activity', matchSource='symbols_fts' |

---

### E2E-API-02: code_search includes pega symbols

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-02 |
| **Level** | E2E-API |
| **UC/BR** | UC-05, BR-25 |
| **Priority** | High |
| **Steps** | 1. Call code_search(query:"ApproveLeave") |
| **Expected** | Results include pega_* kind symbol |

---

### E2E-API-03: FTS handles PascalCase names

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-03 |
| **Level** | E2E-API |
| **UC/BR** | UC-05, BR-28 |
| **Priority** | Medium |
| **Steps** | 1. Index 'ApproveLeaveRequest'; 2. Search 'approve leave' |
| **Expected** | Rule found via porter stemmer |

---

### E2E-API-04: Enrichment timeout after 30s

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-04 |
| **Level** | E2E-API |
| **UC/BR** | UC-02, BR-13 |
| **Priority** | Medium |
| **Steps** | 1. Mock LLM 35s delay; 2. Process task |
| **Expected** | enrichment_status='FAILED' |

---

### E2E-API-05: FTS rebuild includes Pega symbols

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-05 |
| **Level** | E2E-API |
| **UC/BR** | UC-05, BR-30 |
| **Priority** | Medium |
| **Steps** | 1. Insert symbols; 2. Rebuild FTS; 3. Search |
| **Expected** | Symbols still searchable after rebuild |

---

### E2E-API-06: Cross-project isolation

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-06 |
| **Level** | E2E-API |
| **UC/BR** | SEC-04 |
| **Priority** | High |
| **Steps** | 1. Index rule in project_A; 2. Search from project_B |
| **Expected** | No project_A results |

---

### E2E-API-07: Migration --dry-run

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-07 |
| **Level** | E2E-API |
| **UC/BR** | UC-03 |
| **Priority** | Medium |
| **Steps** | 1. Run migration --dry-run; 2. Check symbols table |
| **Expected** | Exit 0, no new symbols |

---

### E2E-API-08: Migration JSON summary

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-08 |
| **Level** | E2E-API |
| **UC/BR** | UC-03, BR-16 |
| **Priority** | Medium |
| **Steps** | 1. Run migration; 2. Parse stdout |
| **Expected** | JSON with status, total, migrated, skipped, errors, durationMs |

---

## 5. E2E-UI Tests

No UI test cases for SA4E-171 (no UI changes).

---

## 6. SIT — System Integration Tests

### SIT-01: Full ingest → FTS → search pipeline

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-01 |
| **Level** | SIT |
| **UC/BR** | UC-01, UC-04, UC-05 |
| **Priority** | High |
| **Preconditions** | On-disk SQLite WAL, full schema |
| **Steps** | 1. syncRuleToSymbols with valid rule |
| | 2. Wait for trigger |
| | 3. Search by rule name |
| **Expected** | Rule found with correct metadata |

---

### SIT-02: Migration → enrichment → search lifecycle

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-02 |
| **Level** | SIT |
| **UC/BR** | UC-02, UC-03, UC-04 |
| **Priority** | High |
| **Steps** | 1. Seed 20 rules in knowledge_entries |
| | 2. Run migration |
| | 3. Process enrichment tasks (mock LLM) |
| | 4. Search enriched rules |
| **Expected** | Rules found with summary populated |

---

### SIT-03: Dual-write + dual-read consistency

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-03 |
| **Level** | SIT |
| **UC/BR** | UC-04, BR-14, BR-21 |
| **Priority** | High |
| **Steps** | 1. Dual-write ingest; 2. Search (deduped) |
| | 3. Disable dual-write; 4. New ingest (symbols only); 5. Search |
| **Expected** | No duplicates in any search |

---

### SIT-04: Migration 10k rules < 5 minutes

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-04 |
| **Level** | SIT |
| **UC/BR** | UC-03, BR-16 |
| **Priority** | High |
| **Preconditions** | 10,000 synthetic rules seeded |
| **Steps** | 1. Time migration script execution |
| **Expected** | Duration < 300,000ms |
| **Test Data** | Generated from pega-rules-small.csv patterns |

---

### SIT-05: FTS search <50ms p50

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-05 |
| **Level** | SIT |
| **UC/BR** | UC-05, BR-24, BR-29 |
| **Priority** | High |
| **Preconditions** | 10k+ Pega symbols indexed |
| **Steps** | 1. Run 100 queries; 2. Measure latency |
| **Expected** | p50 < 50ms, p99 < 100ms |
| **Test Data** | pega-search-queries.csv |

---

### SIT-06: Concurrent search during migration

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-06 |
| **Level** | SIT |
| **UC/BR** | UC-03, UC-04 |
| **Priority** | Medium |
| **Steps** | 1. Start migration; 2. Concurrent searches |
| **Expected** | No errors, no deadlocks |

---

## 7. Test Data Files

Located at: `documents/SA4E-171/test-data/`

| File | Columns | Rows | Purpose |
|------|---------|------|---------|
| pega-mapping-inputs.csv | pxObjClass, expectedKind, category, isWildcard | 20 | Mapping validation |
| pega-rules-small.csv | pxObjClass, pyClassName, pyRuleName, ruleJsonSnippet, expectedKind | 50 | Functional tests |
| pega-rules-migration.csv | id, type, content, source, project_id, summary | 100 | Migration tests |
| pega-search-queries.csv | query, expectedKind, expectedName, minResults | 30 | Search validation |
| pega-security-inputs.csv | inputType, value, expectedBehavior, finding | 25 | Security tests |
