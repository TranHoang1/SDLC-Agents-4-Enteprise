# User Guide — SA4E-125: Context Compaction & Model Tiering

## Overview

This feature adds intelligent context window management to the SDLC pipeline. Instead of static token estimates, the SM now monitors usage in real-time, compacts at logical breakpoints, and selects appropriate model tiers per task.

## Quick Start

The feature is configuration-driven — no code changes required. Once the steering file is loaded, SM automatically applies context optimization rules.

### Activation

The steering file at `.kiro/steering/context-compaction.md` is auto-loaded by SM at session start. No manual activation needed.

---

## Features

### 1. Context Usage Monitoring

SM tracks estimated token usage per phase and warns at configurable thresholds:

| Level | Threshold | Behavior |
|-------|-----------|----------|
| Normal | 0–60% | No action |
| Warn | 60–80% | SM notifies user |
| Critical | 80–90% | SM force-compacts before continuing |
| Emergency | 90%+ | SM compacts immediately, keeps only essentials |

### 2. Strategic Compaction at Breakpoints

After each phase completes, SM automatically:
- Summarizes key decisions (3-5 points)
- Lists artifacts produced
- Drops intermediate reasoning and full document text
- References KB for retrieval when needed later

### 3. Model Tiering

Tasks are classified by complexity and routed to appropriate models:

- **Tier 1 (Full):** BRD/FSD/TDD creation, code implementation, security audit
- **Tier 2 (Medium):** Code review, diagram generation
- **Tier 3 (Light):** File reads, Jira transitions, DOCX export

### 4. Budget Advisor

Before each sub-agent invocation, SM estimates token cost and advises:

```
💡 Context Advisor:
- Estimated next action: ~70k tokens
- Current usage: 320k/500k (64%)
- Recommendation: proceed
```

### 5. Tool Count Awareness

When >30 MCP tools are loaded, SM suggests disabling unused tools per phase. This saves 5,000–10,000 tokens per invocation.

---

## Configuration

### Token Budget (in STATUS.json)

The `tokenBudget` section in STATUS.json controls daily limits:

```json
{
  "tokenBudget": {
    "dailyCap": 500000,
    "warningThreshold": 0.8,
    "mode": "normal"
  }
}
```

### Customizing Thresholds

Edit `.kiro/steering/context-compaction.md` section 1 to adjust warning levels.

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| SM stops mid-pipeline | Token budget exhausted | Reset budget: "reset budget" command |
| Context too large after Phase 3 | Compaction not triggered | Manually say "compact context" |
| Wrong model tier selected | Task misclassified | Override with explicit agent name |
| Tools still loaded after disable | Toggle not persisted | Re-run `toggle_tool` at session start |

---

## Reference: Token Estimates

| Operation | Typical Cost |
|-----------|-------------|
| Full pipeline (no retries) | 500k–700k |
| Full pipeline (with retries) | 700k–1M |
| Single phase (average) | 50k–80k |
| Simple lookup/transition | 3k–8k |
