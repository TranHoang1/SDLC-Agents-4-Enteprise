# Jira Ticket Draft — Pega Rule Schema Generator

## Ticket Info

| Field | Value |
|-------|-------|
| Project | SA4E |
| Type | Story |
| Priority | High |
| Labels | pega, schema, indexer, code-intelligence |
| Epic | Pega Integration |

## Summary

**[pega] Pega Rule Schema Generator — Auto-generate JSON Schemas from Harness RuleForms**

## Description

### Mục tiêu

Tạo utility trong **index workspace command** để tự động crawl Harness RuleForms từ Pega → parse sections/controls → generate JSON Schema (draft-07) cho từng rule type.

### Ý tưởng chi tiết

1. Gọi API `/rules/listRules` (Service 10) với `ObjClass=Rule-HTML-Harness`, `FilterPropName=pyStreamName`, `FilterPropValue=RuleForm` → loop pagination lấy tất cả harnesses
2. Group by `pyClassName` (= rule type, vd `Rule-Obj-Activity`, `Rule-Obj-Flow`, `Rule-Obj-Model`)
3. Với mỗi rule type: dùng `/rules/query` (Service 2) để lấy full Harness JSON data
4. Parse Harness JSON: extract Sections (recursive/nested — sections chứa sections)
5. Mỗi Section chứa UI controls → map vào properties của rule
6. Xác định mandatory/optional, field types, valid values từ control configuration
7. Generate JSON Schema **draft-07** per rule type
8. Save to `schemas/auto/{pxObjClass}.json`

### Output

- `schemas/auto/{RuleType}.json` cho mỗi rule type
- Schema phục vụ:
  - **Validate** rule JSON do LLM tạo (trước khi save vào Pega) — Dual-Tier Layer 1
  - **Hiểu ngữ nghĩa** fields (field descriptions, mandatory/optional, types)
  - **Graph edges** (rule relationships) — deferred → Phase UAT

### Scope

- **ALL rule types** (tất cả harnesses — ~110 instances, ~20+ distinct pyClassName)
- **Format**: JSON Schema draft-07
- **Integration**: thêm option "Index Pega Rule Schemas" trong index workspace QuickPick

### Technical Notes

- Dùng `PegaHttpClient` existing methods: `listRulesByFilter()` (new) + `queryRuleByTriple()`
- New service: `PegaSchemaGenerator.ts` (extension/src/services/)
- Recursive section parser: extract `pyHeaderSection`, `pyContentSection`, `pyFooterSection`, nested sections
- UI control → property mapping: `pyFieldName`, `pyPropertyName`, control type → JSON type inference
- Existing `PegaRuleAstParser.buildUi()` chỉ extract layouts — cần deep parsing cho sections/controls

## Acceptance Criteria

- **AC1**: Index workspace command có option mới "Index Pega Rule Schemas" trong QuickPick
- **AC2**: Crawl ALL RuleForm harnesses từ Pega server (paginated, handles >50 results)
- **AC3**: Group harnesses by pyClassName, fetch full JSON for each unique rule type
- **AC4**: Parse harness sections recursively (nested sections, UI controls)
- **AC5**: Generate valid JSON Schema draft-07 per rule type with:
  - `required` fields (mandatory controls)
  - `properties` with types inferred from UI control types
  - `description` from control labels/tooltips
- **AC6**: Schema files saved to `schemas/auto/{RuleType}.json`
- **AC7**: Existing Dual-Tier Safety Architecture Layer 1 validation uses generated schemas
- **AC8**: Graph edges from schema relationships → deferred to UAT (documented as TODO)

## JSON Schema Format Decision

**Chosen: draft-07** — Lý do:
- Project đã dùng `zod` → `zod-to-json-schema` output draft-07
- `ajv` (default mode) validate draft-07 nhanh nhất
- LLM tools (MCP inputSchema, OpenAI function calling) đều dùng draft-07
- Pega rule fields không cần draft-2020-12 features (dynamic refs, prefix items)

## Phase Planning

| Phase | Scope | Status |
|-------|-------|--------|
| Implementation | Schema generator + index option | In Scope |
| UAT | Graph edges from schema relationships | Deferred |

---

*Tạo ticket này trên Jira khi Atlassian MCP server reconnected, hoặc tạo thủ công trên Jira UI.*
