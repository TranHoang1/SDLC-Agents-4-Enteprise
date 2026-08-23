# Technical Design Document (TDD)

## SA4E-187: Steering Conditional Loading — fileMatch + manual trigger from engine

**Version:** 1.0 | **Date:** 2026-08-22 | **Author:** SA Agent

## 1. Architecture Overview
Steering loader hooks into LangGraph tool execution pipeline. PostToolUse hook evaluates fileMatchPattern against file_path. Manual trigger via slash command invokes askAgent hook to load rule.

## 2. Components
- steering-loader.ts: parse patterns, cache rules
- ToolHookService: postToolUse interceptor
- SteeringInjector: appends rules to state.steeringRules
- DeduplicationCache: Set<ruleId>

## 3. Design Decisions
- Evaluation <5ms via pre-compiled regex
- Inject via state, not recompile graph
- Cache invalidation on file mtime change

## 4. Sequence Diagram
User → slash command → askAgent → load manual rule → next LLM turn
Agent read_file → postToolUse → match fileMatchPattern → load rule → next turn

## 5. Pseudocode
function evaluateFileMatch(filePath) {
  return rules.filter(r => r.inclusion==='fileMatch' && regex.test(filePath))
}

## 6. Testing Strategy
Unit tests for regex matching, performance benchmark, deduplication

## 7. Risks
- Hook latency → mitigate with async evaluation

## 8. Diagrams
- Component: documents/SA4E-187/diagrams/component.png
- Class: documents/SA4E-187/diagrams/class.png

