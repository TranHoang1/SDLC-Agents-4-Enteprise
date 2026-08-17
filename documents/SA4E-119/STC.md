# System Test Cases (STC)

## SA4E — SA4E-119: [Epic] ECC Feature Parity - Import Missing Concepts

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-119 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-16 |
| Related STP | STP-v1-SA4E-119.docx |
| Total Test Cases | 196 |

---

## 1. UC-1: Confidence Scoring (SA4E-121)

### 1.1 Property-Based Tests (PBT)

#### TC-0111: PBT — Confidence always clamped [0.0, 1.0]

| Attribute | Value |
|-----------|-------|
| Level | PBT |
| BR | BR-104 |
| Property | For any input, computeInitial() output is in [0.0, 1.0] |

```typescript
fc.assert(fc.property(
  fc.float({ min: -100, max: 100 }),
  fc.string(),
  (overrideValue, sourceType) => {
    const result = scorer.computeInitial(entry, { confidence_override: overrideValue, source_type: sourceType });
    return result >= 0.0 && result <= 1.0;
  }
));
```

#### TC-0112: PBT — Confidence clamped after decay

| Attribute | Value |
|-----------|-------|
| Level | PBT |
| BR | BR-103, BR-104 |
| Property | After any number of decay weeks, confidence >= 0.1 (floor) |

```typescript
fc.assert(fc.property(
  fc.integer({ min: 0, max: 1000 }),
  (weeksStale) => {
    const result = scorer.applyDecay(0.9, weeksStale);
    return result >= 0.1 && result <= 1.0;
  }
));
```

#### TC-0105: PBT — Corroboration monotonically increases confidence

| Attribute | Value |
|-----------|-------|
| Level | PBT |
| BR | BR-102 |
| Property | Adding corroboration sources never decreases confidence |

```typescript
fc.assert(fc.property(
  fc.integer({ min: 0, max: 20 }),
  (sourceCount) => {
    const before = scorer.computeWithCorroboration(entry, sourceCount);
    const after = scorer.computeWithCorroboration(entry, sourceCount + 1);
    return after >= before;
  }
));
```

#### TC-0108: PBT — Decay is monotonically decreasing over time

| Attribute | Value |
|-----------|-------|
| Level | PBT |
| BR | BR-103 |
| Property | More weeks stale = lower confidence (monotonic decrease) |

```typescript
fc.assert(fc.property(
  fc.integer({ min: 1, max: 52 }),
  (week) => {
    const earlier = scorer.applyDecay(0.9, week);
    const later = scorer.applyDecay(0.9, week + 1);
    return later <= earlier;
  }
));
```

### 1.2 Unit Tests (UT)

#### TC-0101: UT — Default confidence is 0.5

| Level | UT | BR | BR-101 | Class | ConfidenceScorer | Method | computeInitial() |
|-------|----|----|--------|-------|-----------------|--------|-----------------|

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Call computeInitial with no override, source_type='user_input' | Returns 0.5 |
| 2 | Verify no corroboration_count set | corroboration_count = 0 |
| 3 | Verify confidence_source | 'initial' |

#### TC-0104: UT — Confidence >= 0.8 with 3+ corroborations

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create entry with confidence 0.5 | Entry created |
| 2 | Call corroborate() with 3 unique sources | Confidence >= 0.8 |
| 3 | Call corroborate() with 2 unique sources | Confidence < 0.8 |

#### TC-0107: UT — Decay logic after 30 days

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Entry with last_refreshed_at = 37 days ago (1 week stale) | decay applies |
| 2 | Run decay | Confidence reduced by 0.1 |
| 3 | Entry with last_refreshed_at = 51 days ago (3 weeks stale) | deeper decay |
| 4 | Run decay | Confidence reduced by 0.3 |
| 5 | Entry with last_refreshed_at = 29 days ago (not stale) | no decay |
| 6 | Run decay | No change |

#### TC-0109: UT — Decay floor at 0.1

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Entry with confidence 0.2, 100 weeks stale | Would decay far below |
| 2 | Run decay | Confidence = 0.1 (floor) |

#### TC-0113: UT — Instincts are project-scoped

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create instinct for project 'A' | Success |
| 2 | Load instincts for project 'A' | Returns 1 instinct |
| 3 | Load instincts for project 'B' | Returns empty array |

#### TC-0114: UT — Instinct boost applied during re-ranking

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create 'prefer_recent' instinct with weight 1.5 | Success |
| 2 | Search results: [entry_old(relevance=0.9), entry_new(relevance=0.7)] | Ranked by relevance |
| 3 | Apply boosts with prefer_recent | entry_new re-ranked higher |

#### TC-0102: UT — Confidence override bypasses computation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Call computeInitial with confidence_override=0.95 | Returns 0.95 |
| 2 | Call computeInitial with confidence_override=1.5 | Clamped to 1.0 |
| 3 | Call computeInitial with confidence_override=-0.5 | Clamped to 0.0 |

#### TC-0110: UT — Confidence source tracking

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | New entry | confidence_source = 'initial' |
| 2 | After corroboration | confidence_source = 'corroboration' |
| 3 | After decay | confidence_source = 'decay' |
| 4 | After manual override | confidence_source = 'manual' |

### 1.3 Integration Tests (IT)

#### TC-0103: IT — mem_ingest stores confidence in DB

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Call mem_ingest via module handler | Entry stored in knowledge_entries |
| 2 | Query DB for the entry | confidence = 0.5, corroboration_count = 0 |
| 3 | Call mem_ingest with confidence_override=0.9 | confidence = 0.9 in DB |

#### TC-0106: IT — Corroboration updates DB correctly

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Insert entry with confidence 0.5 | Stored |
| 2 | Corroborate with source1 | corroboration_count = 1 |
| 3 | Corroborate with source2, source3 | corroboration_count = 3, confidence >= 0.8 |
| 4 | Verify last_refreshed_at updated | Timestamp set to now |

#### TC-0109-IT: IT — Batch decay job updates multiple entries

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Insert 5 entries: 2 stale (40 days), 3 fresh (10 days) | 5 entries in DB |
| 2 | Run ConfidenceDecayJob | Returns count = 2 |
| 3 | Verify stale entries decayed | Confidence decreased by 0.1 each |
| 4 | Verify fresh entries unchanged | Original confidence retained |

#### TC-0114-IT: IT — Instinct CRUD via database

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | INSERT instinct for project 'test-proj' | id returned |
| 2 | SELECT by project_id | 1 row returned |
| 3 | UPDATE weight to 1.8 | updated_at changed |
| 4 | DELETE instinct | 0 rows for project |

#### TC-0115-IT: IT — Search re-ranking with confidence

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Insert entry A (relevance 0.9, confidence 0.3) | Stored |
| 2 | Insert entry B (relevance 0.7, confidence 0.9) | Stored |
| 3 | Search and apply re-ranking | B ranked above A (0.63 > 0.27) |

#### TC-0116-IT: IT — Unique constraint on instinct project+name

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Insert instinct (project='p1', name='prefer_recent') | Success |
| 2 | Insert duplicate (project='p1', name='prefer_recent') | UNIQUE constraint error |
| 3 | Insert same name different project (project='p2', name='prefer_recent') | Success |

### 1.4 E2E API Tests

#### TC-0103-E2E: E2E-API — instinct_manage CRUD lifecycle

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | POST tools/call: instinct_manage(action='create') | 200, instinct with id |
| 2 | POST tools/call: instinct_manage(action='list') | Array with 1 instinct |
| 3 | POST tools/call: instinct_manage(action='update', weight=1.8) | Updated |
| 4 | POST tools/call: instinct_manage(action='delete') | Deleted |
| 5 | POST tools/call: instinct_manage(action='list') | Empty array |

#### TC-0103-E2E2: E2E-API — instinct_manage validation errors

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create with weight=5.0 | Error: INVALID_WEIGHT |
| 2 | Create with weight=0.0 | Error: INVALID_WEIGHT |
| 3 | Create with rule_type='invalid' | Error: INVALID_RULE_TYPE |
| 4 | Delete with non-existent id | Error: NOT_FOUND |

#### TC-0103-E2E3: E2E-API — mem_search returns confidence

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Ingest entry via mem_ingest | Success |
| 2 | Search via mem_search | Results include 'confidence' field |
| 3 | Verify instinct_boosts in response | Object with applied boosts |

#### TC-0103-E2E4: E2E-API — mem_ingest with confidence_override

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | mem_ingest with confidence_override=0.95 | Success |
| 2 | mem_search for the entry | confidence = 0.95 in response |

### 1.5 System Integration Tests (SIT)

#### TC-0117-SIT: SIT — End-to-end confidence lifecycle

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Ingest entry (confidence=0.5) | Stored |
| 2 | Corroborate 3 times | Confidence >= 0.8 |
| 3 | Wait simulation (40 days) | Decay applied |
| 4 | Search with instincts | Correctly re-ranked |

#### TC-0118-SIT: SIT — Instincts affect real search results

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Ingest 10 KB entries with varying ages | Stored |
| 2 | Create prefer_recent instinct | Active |
| 3 | Search query | Recent entries boosted in results |

---

## 2. UC-12: GateGuard (SA4E-132) — Full Test Cases

### 2.1 Property-Based Tests (PBT)

#### TC-1206-PBT: PBT — Non-destructive commands always pass < 50ms

```typescript
fc.assert(fc.property(
  fc.constantFrom('npm test', 'git status', 'ls -la', 'cat file.txt', 'echo hello'),
  async (cmd) => {
    const start = performance.now();
    const result = await gateGuard.evaluate(cmd);
    const elapsed = performance.now() - start;
    return result.action === 'allow' && elapsed < 50;
  }
));
```

#### TC-1207-PBT: PBT — Default denylist patterns always block

```typescript
fc.assert(fc.property(
  fc.constantFrom(
    'git push --force origin main', 'rm -rf /',
    'DROP TABLE users', 'DELETE FROM orders;', 'git reset --hard HEAD~5'
  ),
  async (cmd) => {
    const result = await gateGuard.evaluate(cmd);
    return result.action === 'block';
  }
));
```

#### TC-1208-PBT: PBT — Evaluation latency < 50ms for any input

```typescript
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 4096 }),
  async (cmd) => {
    const start = performance.now();
    await gateGuard.evaluate(cmd);
    return (performance.now() - start) < 50;
  }
));
```

#### TC-1213-PBT: PBT — Override hash is deterministic

```typescript
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 200 }),
  (cmd) => {
    const hash1 = gateGuard.computeHash(cmd);
    const hash2 = gateGuard.computeHash(cmd);
    return hash1 === hash2;
  }
));
```

### 2.2 Unit Tests (UT)

#### TC-1201: UT — Default denylist blocks known patterns

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Evaluate 'git push --force origin main' | BLOCK |
| 2 | Evaluate 'rm -rf /' | BLOCK |
| 3 | Evaluate 'DROP TABLE users' | BLOCK |
| 4 | Evaluate 'DELETE FROM orders;' | BLOCK |
| 5 | Evaluate 'git reset --hard' | BLOCK |

#### TC-1204: UT — Override requires user identity

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Override with valid user identity + admin role | Allowed |
| 2 | Override without identity (agent self-approve) | Rejected |
| 3 | Override with wrong role | Rejected |

#### TC-1206-UT: UT — Non-destructive passes immediately

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Evaluate 'npm test' | ALLOW, latency < 5ms |
| 2 | Evaluate 'git status' | ALLOW |
| 3 | Evaluate 'cat package.json' | ALLOW |

#### TC-1211: UT — Custom patterns per project

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add custom pattern 'kubectl delete.*prod' for project A | Added |
| 2 | Evaluate 'kubectl delete pod prod-api' in project A | BLOCK |
| 3 | Evaluate same command in project B | ALLOW |

#### TC-1214-UT: UT — Override is single-use

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Command blocked, hash generated | hash returned |
| 2 | Override with hash | Allowed once |
| 3 | Same command submitted again | Blocked again |

#### TC-1215-UT: UT — Command length validation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Command with 4096 chars | Valid, evaluated |
| 2 | Command with 4097 chars | Rejected: too long |
| 3 | Empty command | Rejected: empty |

#### TC-1216-UT: UT — DenylistManager pattern compilation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Load default patterns | Compiled regex Set |
| 2 | Add valid custom pattern | Compiled and added |
| 3 | Add invalid regex '(a+)+' | Rejected (ReDoS risk) |

#### TC-1217-UT: UT — Case sensitivity in matching

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Evaluate 'DROP TABLE users' | BLOCK |
| 2 | Evaluate 'drop table users' | BLOCK (case-insensitive) |
| 3 | Evaluate 'Git Push --Force' | BLOCK |

### 2.3 Integration Tests (IT)

#### TC-1202: IT — Denylist loaded and cached

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Initialize GateGuard | Denylist loaded |
| 2 | First evaluate call | Uses cached patterns |
| 3 | Add new pattern via gateguard_denylist | Cache invalidated |
| 4 | Next evaluate call | Includes new pattern |

#### TC-1205: IT — Override flow with audit logging

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Evaluate 'git push --force' | BLOCK, hash returned |
| 2 | Override with hash + user='admin' | ALLOW |
| 3 | Query gateguard_audit | 2 entries: blocked + overridden |

#### TC-1209: IT — Audit trail append-only

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Insert 5 audit entries | 5 rows |
| 2 | Verify entries cannot be deleted via API | No delete operation |
| 3 | Verify ordering by timestamp | Chronological |

#### TC-1210: IT — Audit log query performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Insert 1000 audit entries | Stored |
| 2 | Query recent 10 by project | Returns in < 50ms |

#### TC-1212: IT — Custom patterns CRUD

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add pattern 'docker rm.*--force' | Stored |
| 2 | Evaluate matching command | BLOCK |
| 3 | Remove pattern | Removed |
| 4 | Evaluate same command | ALLOW |

#### TC-1217-IT: IT — PreToolUse hook integration

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Agent calls execute_command with 'rm -rf /' | Hook fires |
| 2 | GateGuard evaluates | BLOCK returned |
| 3 | Tool execution prevented | Command NOT executed |

### 2.4 E2E API Tests

#### TC-1203: E2E-API — gateguard_evaluate tool

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | gateguard_evaluate(command='git push --force main') | BLOCK with hash |
| 2 | gateguard_evaluate(command='npm test') | ALLOW with latency_ms < 50 |

#### TC-1203-E2E2: E2E-API — gateguard_denylist CRUD

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | gateguard_denylist(action='list') | Default patterns |
| 2 | gateguard_denylist(action='add', pattern='docker system prune -a') | Added |
| 3 | gateguard_denylist(action='remove', pattern_id=X) | Removed |

#### TC-1203-E2E3: E2E-API — gateguard_audit_log query

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Generate blocked events | Entries created |
| 2 | gateguard_audit_log(project_id='test', limit=10) | Returns entries |

#### TC-1203-E2E4: E2E-API — gateguard_evaluate validation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Empty command | Error |
| 2 | Command > 4096 chars | Error |

#### TC-1203-E2E5: E2E-API — Override single-use via API

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Evaluate blocked command → hash | hash returned |
| 2 | Override(hash) | Success |
| 3 | Re-evaluate same command | BLOCK again |

### 2.5 System Integration Tests (SIT)

#### TC-1218-SIT: SIT — GateGuard blocks agent in live pipeline

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | LangGraph agent attempts 'git push --force' | Hook fires |
| 2 | Tool blocked | Agent receives blocked response |
| 3 | Agent handles gracefully | Reports to SM |

#### TC-1219-SIT: SIT — GateGuard + AgentShield combined

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Config change triggers AgentShield | Findings produced |
| 2 | Agent tries destructive command | GateGuard blocks |
| 3 | Both systems operational | No interference |

#### TC-1220-SIT: SIT — Override audit visible via API

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Block + override in extension | Audit recorded |
| 2 | Query via gateguard_audit_log | Override entry visible |

---

## 3-11. Remaining Use Cases (Condensed)

The remaining use cases (UC-2 through UC-11) follow the same structure. Key test cases are documented in their respective sections in the STP RTM. Full details:

- **UC-2 (Skill Packs):** 18 test cases — pack install/remove/compose/conflict
- **UC-3 (Fresh-Context):** 12 test cases — trigger detection, isolation, blind spots
- **UC-4 (Context Compaction):** 13 test cases — threshold levels, token limits
- **UC-5 (Adversarial Review):** 11 test cases — loop termination, context isolation
- **UC-6 (Council Decision):** 10 test cases — voice count, unanimity, split handling
- **UC-7 (AgentShield):** 19 test cases — secret detection, HTTP, injection, pipeline block
- **UC-8 (Plan Canvas):** 10 test cases — rendering, auto-refresh, click interactions
- **UC-9 (Pattern Extraction):** 15 test cases — extraction, deduplication, promotion
- **UC-10 (Model Tiering):** 12 test cases — classification, routing, override
- **UC-11 (Codebase Onboarding):** 12 test cases — generation, caching, timeout

---

## 12. Security Test Cases (SEC-01 to SEC-08)

### TC-SEC-01: GateGuard override without authentication

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Generate override hash for 'rm -rf /' | Hash known |
| 2 | Attempt override without JWT/identity | REJECTED |
| 3 | Verify audit shows unauthorized attempt | Logged |

### TC-SEC-02: GateGuard override with non-admin role

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Override with role='agent' | REJECTED |
| 2 | Override with role='gateguard_admin' | Allowed |

### TC-SEC-03: Agent cannot self-approve blocked command

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Agent's command blocked | Hash returned |
| 2 | Same agent session attempts override | REJECTED |
| 3 | Human session overrides | Allowed |

### TC-SEC-04: Skill pack without checksum rejected

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Install pack with valid checksum | Success |
| 2 | Install pack missing checksum | Rejected |
| 3 | Install pack with wrong checksum | Rejected |

### TC-SEC-05: Skill pack with tampered content

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Modify steering file after install | File modified |
| 2 | Pack integrity check | Detected: hash mismatch |
| 3 | Pack flagged or disabled | Warning emitted |

### TC-SEC-06: Skill pack with prompt injection

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Pack contains 'ignore previous instructions' | Malicious |
| 2 | AgentShield scans at install | SHIELD-003 finding |
| 3 | Install blocked or warned | User informed |

### TC-SEC-07: MCP tool without required role

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | instinct_manage with role='agent' | Rejected |
| 2 | skill_pack_install with role='agent' | Rejected |
| 3 | gateguard_evaluate with role='agent' | Allowed |

### TC-SEC-08: Tool authorization matrix

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | gateguard_denylist with role='agent' | Rejected |
| 2 | gateguard_denylist with role='security_admin' | Allowed |

### TC-SEC-09: ReDoS pattern rejected

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add pattern '(a+)+b' | Rejected: backtracking |
| 2 | Add pattern '(.*)+$' | Rejected |
| 3 | Add pattern 'git push --force.*' | Accepted |

### TC-SEC-10: ReDoS benchmark timeout

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Pattern taking >10ms on benchmark | Rejected |
| 2 | Pattern > 200 chars | Rejected |

### TC-SEC-11: condition_json schema validation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Valid: `{"field":"source","operator":"eq","value":"doc"}` | Accepted |
| 2 | Invalid field: `{"field":"$where"}` | Rejected |
| 3 | Depth > 3 | Rejected |
| 4 | Arbitrary shape | Rejected |

### TC-SEC-12: condition_json injection attempt

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | SQL in value: `"'; DROP TABLE --"` | Value stored as string (no exec) |
| 2 | Proto pollution: `{"__proto__":{"admin":true}}` | Rejected |

### TC-SEC-13: Scan path .env blocked

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Scan paths: ['.env'] | Rejected |
| 2 | Scan paths: ['.env.local'] | Rejected |
| 3 | Scan paths: ['.kiro/agents/config.json'] | Allowed |

### TC-SEC-14: Scan path traversal blocked

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | '../../../etc/passwd' | Rejected |
| 2 | Absolute path outside workspace | Rejected |

---

## 13. System Integration Tests (SIT)

### TC-SIT-01: Confidence scoring + Pattern extraction

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Complete ticket lifecycle (DONE) | Event fired |
| 2 | Patterns extracted with confidence | confidence = 0.7 |
| 3 | Search patterns | Ranked by confidence |

### TC-SIT-02: GateGuard + Fresh-Context isolation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Fresh-context reviewer attempts destructive command | GateGuard blocks |
| 2 | Reviewer cannot access override | No history access |

### TC-SIT-03: AgentShield + Skill Pack install

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Install skill pack | Files written |
| 2 | AgentShield auto-scans | Scan triggered |
| 3 | Malicious content found | Pipeline blocked |

### TC-SIT-04: Model Tiering + Context Compaction

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Context at 75% | Compaction suggested |
| 2 | Next task is 'file_read' | Fast model used |
| 3 | Both save resources | Savings reported |

### TC-SIT-05: Council Decision + Adversarial Review

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Council produces recommendation | Decision made |
| 2 | Adversarial attacks decision | Gaps found |
| 3 | Generator revises | Improved output |

---

## 14. Test Data Specifications

### 14.1 confidence-scores.csv

```csv
test_id,source_type,corroboration_count,age_days,confidence_override,expected_confidence
TC-0101,user_input,0,0,,0.5
TC-0104,verified_doc,3,5,,0.8
TC-0107,code_analysis,0,37,,0.7
TC-0109,user_input,0,100,,0.1
TC-0102,user_input,0,0,0.95,0.95
TC-0111,user_input,0,0,1.5,1.0
TC-0112,user_input,0,0,-0.5,0.0
```

### 14.2 gateguard-commands.csv

```csv
test_id,command,expected_action,pattern_matched
TC-1201a,git push --force origin main,block,git push --force.*
TC-1201b,rm -rf /,block,rm -rf\s+(/|~|\.\.)
TC-1201c,DROP TABLE users,block,DROP\s+TABLE
TC-1201d,DELETE FROM orders;,block,DELETE\s+FROM\s+\w+\s*;?\s*$
TC-1201e,git reset --hard HEAD~5,block,git reset --hard
TC-1206a,npm test,allow,
TC-1206b,git status,allow,
TC-1206c,ls -la /home,allow,
TC-1206d,cat package.json,allow,
TC-1206e,git push origin feature,allow,
```

### 14.3 agentshield-configs.json

```json
{
  "malicious_secret": {
    "file": ".kiro/agents/test.json",
    "content": "{\"api_key\": \"AKIAIOSFODNN7EXAMPLE\"}",
    "expected": [{"severity": "CRITICAL", "rule": "hardcoded_secret"}]
  },
  "malicious_http": {
    "file": "mcp.json",
    "content": "{\"servers\": [{\"url\": \"http://external.com:8080/mcp\"}]}",
    "expected": [{"severity": "HIGH", "rule": "http_endpoint"}]
  },
  "clean_config": {
    "file": ".kiro/agents/clean.json",
    "content": "{\"name\": \"test-agent\", \"model\": \"claude-sonnet-4\"}",
    "expected": []
  }
}
```

### 14.4 skill-pack-manifests.json

```json
{
  "valid": {"name": "typescript-hono", "version": "1.2.0", "sa4e_compat": ">=1.0.0"},
  "missing_version": {"name": "bad-pack", "sa4e_compat": ">=1.0.0"},
  "incompatible": {"name": "future-pack", "version": "3.0.0", "sa4e_compat": ">=5.0.0"}
}
```

### 14.5 instinct-conditions.json

```json
{
  "valid": {"field": "source", "operator": "eq", "value": "verified_doc"},
  "invalid_field": {"field": "$where", "operator": "exec", "value": "malicious()"},
  "too_deep": {"field":"a","operator":"eq","value":"x","and":[{"field":"b","operator":"eq","value":"x","and":[{"field":"c","operator":"eq","value":"x","and":[{"field":"d","operator":"eq","value":"x"}]}]}]},
  "proto_pollution": {"__proto__": {"admin": true}}
}
```
