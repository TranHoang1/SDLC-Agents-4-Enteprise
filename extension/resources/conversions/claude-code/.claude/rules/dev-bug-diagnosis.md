# DEV Bug Diagnosis Loop

## Core Rule

> **"No red-capable command, no fix attempt."**
> DEV CANNOT attempt a fix unless they have a failing test that reproduces the bug.

## Trigger Conditions

- Jira ticket type = Bug
- SM invokes with "Fix bugs" transition
- QA reports test failure needing root-cause investigation

## 6-Phase Diagnosis Loop

### Phase 1: Build Feedback Loop
- Verify project builds and tests run
- Exit: Build green, tests runnable

### Phase 2: Reproduce
- Write a FAILING test demonstrating the bug
- Exit: At least one test FAILS showing the bug
- ⛔ BLOCKED if cannot reproduce → report "Need more info"

### Phase 3: Hypothesise
- Form specific, testable hypothesis (file, line, condition)
- Max 3 hypotheses before seeking help

### Phase 4: Instrument
- Add minimal logging/assertion at suspected location
- Confirm or reject hypothesis
- If rejected → back to Phase 3 (max 3 total)

### Phase 5: Fix
- Apply SMALLEST change that makes reproduction test pass
- All existing tests must still pass
- Remove instrumentation code
- If >20 lines → discuss with SA/SM first

### Phase 6: Cleanup
- Remove ALL debug code
- Name test: `BUG-{TICKET}: {description}`
- Run full suite, check code standards
- Commit: `{TICKET}: fix {description} — root cause: {explanation}`

## Report Format

```
## Bug Fix Report — {TICKET}
**Root Cause:** {explanation}
**File(s) Changed:** {list}
**Reproduction Test:** {test name}
**Fix:** {description}
**Regression:** All {N} tests pass
**Commit:** {hash} — {message}
```

## Anti-Patterns (FORBIDDEN)

- ❌ "Try this fix and see" — write failing test FIRST
- ❌ Fix without reproduction test
- ❌ Shotgun fix (change many things)
- ❌ Skip cleanup (leave debug code)
- ❌ Fix bug + refactor in same commit
