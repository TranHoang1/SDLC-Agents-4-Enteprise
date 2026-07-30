# analyze_artifact — Generic MCP Tool

## Thiết kế

Tool MCP generic: detect artifact type → route đến analyzer phù hợp.

Không có per-language analyzer. Thay vào đó, GenericCodeAnalyzer xử lý MỌI ngôn ngữ
lập trình qua keyword mapping (20+ ngôn ngữ) + redirect LLM đến get_edit_context
cho phân tích sâu.

## Architecture

```
analyze_artifact(content, type?, simulate?)
  └─ ArtifactAnalyzerRegistry.analyze()
       ├─ ArtifactDetector.detect() → pega_rule | code | structured_data | unknown
       └─ Route:
            ├─ pega_rule       → PegaRuleAnalyzer (full understanding)
            ├─ code            → GenericCodeAnalyzer (basic info + redirect)
            ├─ structured_data → StructureAnalyzer (schema tree)
            └─ unknown         → FallbackAnalyzer (basic info)
```

## Analyzers

### PegaRuleAnalyzer
- Detects: `pxObjClass` trong content
- Actions: PegaRuleUnderstandingService.understand()
- Output: schema + semantic + dependencies + simulation

### GenericCodeAnalyzer
- Detects: code patterns (import/export/function/def/class/#include/using/public...)
- Language mapping: 20+ ngôn ngữ (TS, JS, Python, Java, C++, C#, Go, Rust, Ruby,
  PHP, Swift, Kotlin, Scala, Haskell, Lua, R, Dart, etc.)
- Output: line/char count + detected language + imports/functions summary +
  suggestion to use `get_edit_context` for deeper analysis

### StructureAnalyzer
- Detects: JSON (parse), XML (tag syntax), YAML (key:value patterns)
- For JSON: schema tree with types, sample values, nesting depth
- For XML: unique tag extraction
- For YAML: top-level key structure

### FallbackAnalyzer (always matches)
- Output: line/word/char count, MD5 hash, binary detection, content preview

## MCP Tool Definition

```json
{
  "name": "analyze_artifact",
  "description": "Analyze any code artifact (Pega rule, code, JSON, XML, YAML) and return structured understanding",
  "inputSchema": {
    "properties": {
      "content": { "type": "string" },
      "type": { "type": "string", "description": "Optional hint: pega_rule, code, structured_data" },
      "simulate": { "type": "boolean" }
    },
    "required": ["content"]
  }
}
```

## Extending

Thêm analyzer mới (cho domain-specific format):
```typescript
class MyAnalyzer implements ArtifactAnalyzer {
  type = 'my_type' as ArtifactType;
  canAnalyze(content: string): boolean { /* detection logic */ }
  analyze(content: string): ArtifactAnalysis { /* analysis logic */ }
}
registry.register(new MyAnalyzer());
```

## Files

| File | Purpose |
|------|---------|
| `artifact-analyzer/types.ts` | Interfaces |
| `artifact-analyzer/detector.ts` | Content-based type detection |
| `artifact-analyzer/ArtifactAnalyzerRegistry.ts` | Registry + routing |
| `artifact-analyzer/analyzers/PegaRuleAnalyzer.ts` | Pega rule analysis |
| `artifact-analyzer/analyzers/GenericCodeAnalyzer.ts` | Multi-language code analysis |
| `artifact-analyzer/analyzers/StructureAnalyzer.ts` | JSON/XML/YAML structure |
| `artifact-analyzer/analyzers/FallbackAnalyzer.ts` | Default fallback |
| `artifact-analyzer/index.ts` | Re-exports |

## Test coverage

- `__tests__/artifact-analyzer.test.ts` — 27 tests
