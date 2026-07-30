# Pattern Catalog — Architecture Pattern Detection

## Purpose

Detect project architecture pattern to adjust SM pipeline behavior (emphasis, diagrams, testing focus).

## Detection Rules

| Pattern ID | Signals | Weight |
|---|---|---|
| ai-agent | `.claude/agents/*.md`, `.claude/rules/*.md`, prompt files, tool definitions | 0.9 |
| microservice | multiple build files, docker-compose, `services/` or `apps/` dirs | 0.8 |
| monolith | single build file, single src dir, no service separation | 0.6 |
| library | no main entry, `src/main` exports, published to registry | 0.7 |
| cli-tool | main with arg parsing, no server, command handlers | 0.7 |
| data-pipeline | ETL patterns, schedulers, data transformations | 0.7 |
| plugin | extension points, hook system, plugin registry | 0.7 |

## Detection Algorithm

```
function detectPattern(projectRoot):
    scores = {}
    for pattern in catalog:
        score = 0
        for signal in pattern.signals:
            if signalPresent(projectRoot, signal):
                score += signal.weight
        scores[pattern.id] = score * pattern.weight
    detected = maxBy(scores, value)
    if detected.score < 0.3:
        return "monolith"
    return detected.id
```

## Pattern Storage (STATUS.json)

```json
{ "architecturePattern": "ai-agent", "patternDetectedAt": "..." }
```

## Available Patterns

- `ai-agent.md` — AI agent systems
- `microservice.md` — Distributed multi-service systems
- `library.md` — Reusable packages/SDKs
- `cli-tool.md` — Command-line applications
- `data-pipeline.md` — ETL/ELT systems
- `plugin.md` — Extensions for host systems
- `monolith.md` — Traditional monolithic (default)

## Fallback

If detection fails → default to "monolith" → log for debugging.