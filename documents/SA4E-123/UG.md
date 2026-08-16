# SA4E-123 — Reusable Skill Packs: User Guide

## Overview

Skill Packs are reusable knowledge files that teach AI agents about project-specific patterns. Each skill pack lives in `.code-intel/skills/{name}/SKILL.md` and is discoverable via the `find_skill` MCP tool.

## Available Skills (10 total)

| Skill Name | Description |
|-----------|-------------|
| browser-harness | Browser automation patterns |
| drawio-diagrams | Draw.io diagram creation patterns |
| hono-patterns | Hono HTTP framework routes and middleware |
| mcp-server-patterns | MCP Server development and tool registration |
| quality-gates | Quality gate verification patterns |
| sqlite-patterns | SQLite/better-sqlite3 database patterns |
| typescript-patterns | TypeScript strict-mode, generics, discriminated unions |
| vscode-extension-patterns | VS Code extension activation, commands, webviews |
| svelte-webview | Svelte 4 webview patterns for VS Code |
| vitest-testing | Vitest test structure, mocking, property-based testing |

## Using find_skill

### Tool Signature

```json
{
  "name": "find_skill",
  "input": { "query": "string (keywords to search)" },
  "output": { "skills": [...], "count": number, "totalSkills": number }
}
```

### Examples

**Find testing-related skills:**
```
find_skill({ query: "testing vitest" })
```
Returns: vitest-testing skill with score 1.0.

**Find database patterns:**
```
find_skill({ query: "sqlite database" })
```
Returns: sqlite-patterns skill.

**Broad search:**
```
find_skill({ query: "patterns" })
```
Returns all skills containing "patterns" in name or description.

## Creating a New Skill Pack

1. Create directory: `.code-intel/skills/{your-skill-name}/`
2. Create `SKILL.md` with frontmatter:

```markdown
---
name: your-skill-name
description: "Brief description of when to use this skill."
---

# your-skill-name

Detailed patterns, code examples, and anti-patterns.
```

3. The skill is automatically discoverable via find_skill.

### Frontmatter Requirements

- `name`: Must match the directory name (lowercase, hyphenated)
- `description`: One sentence explaining when the skill applies

### Content Guidelines

- Include code examples from actual project code
- Keep file under 200 lines
- Use tables for anti-patterns (Do/Don't format)
- Include file organization section if applicable

## Troubleshooting

| Issue | Solution |
|-------|----------|
| find_skill returns empty | Verify `.code-intel/skills/` directory exists |
| Skill not found | Check frontmatter has valid `name` field |
| Low match score | Use more specific keywords from the skill description |

## Error Codes

| Error | Meaning |
|-------|---------|
| `query is required` | Empty or whitespace-only query provided |
| `No skills found in .code-intel/skills/` | Skills directory missing or empty |
