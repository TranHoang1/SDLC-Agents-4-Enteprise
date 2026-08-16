# User Guide — Codebase Onboarding Skill (SA4E-166)

## Overview

The `onboarding_generate` tool analyzes your codebase structure and generates a comprehensive ONBOARDING.md document. This helps new developers quickly understand the project architecture, dependencies, and how to get started.

## Quick Start

Call the tool with no arguments to generate onboarding documentation:

```json
{
  "tool": "onboarding_generate",
  "arguments": {}
}
```

The generated file is saved to `.code-intel/ONBOARDING.md` in your workspace.

## Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | `false` | Force regeneration bypassing cache |

## Usage Examples

### Generate with cache (default)

```json
{ "tool": "onboarding_generate", "arguments": {} }
```

Returns cached result if less than 20% of files have changed since last generation.

### Force regeneration

```json
{ "tool": "onboarding_generate", "arguments": { "force": true } }
```

Always regenerates fresh content, ignoring cache state.

## Output Structure

The generated ONBOARDING.md contains these sections:

1. **Project Overview** — Name, purpose, and tech stack
2. **Architecture** — Modules and their responsibilities
3. **Key Entry Points** — Main files and startup commands
4. **Dependencies** — Major libraries with versions
5. **Development Setup** — Build, test, and run commands
6. **Module Reference** — Detailed list of modules with exports

## Response Format

```json
{
  "content": "# Project Overview\n...",
  "cached": false,
  "generatedAt": "2025-01-15T10:30:00.000Z"
}
```

| Field | Description |
|-------|-------------|
| `content` | Full ONBOARDING.md markdown content |
| `cached` | `true` if returned from cache, `false` if freshly generated |
| `generatedAt` | ISO timestamp of when the content was generated |

## Cache Behavior (BR-1102)

The tool caches results for performance:

- Cache is stored in `.code-intel/onboarding-cache.json`
- Cache is valid as long as less than 20% of source files have changed
- Cache is invalidated automatically when file changes exceed threshold
- Use `force: true` to bypass cache at any time

## Performance (BR-1101)

Generation completes in under 60 seconds. Typical generation time for medium projects (500-1000 files) is under 1 second.

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Empty module list | No `src/` directory found | Tool falls back to workspace root directories |
| Missing dependencies | No `package.json` present | Create package.json or verify workspace path |
| Stale content | Cache returning old data | Use `force: true` to regenerate |
| Output file missing | `.code-intel/` directory issues | Directory is created automatically on generation |

## Error Codes

| Error | Meaning |
|-------|---------|
| `Validation error: ...` | Invalid input — check `force` is boolean if provided |
| `Error: ...` | Unexpected filesystem error — check workspace permissions |

## Integration

The tool is registered as part of the Code Intelligence module. It appears in `tools/list` responses with category `code`.

No additional configuration is needed — the tool uses the workspace path configured for the Code Intelligence server.
