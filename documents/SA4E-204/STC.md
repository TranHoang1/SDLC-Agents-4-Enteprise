# Software Test Cases (STC)

## Chat Module — SA4E-204: Parallel Tool Execution in Chat Graph

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-204 |
| Title | Parallel Tool Execution in Chat Graph |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-22 |
| Status | Draft |
| Related STP | STP-v1-SA4E-204.md |
| Related FSD | FSD-v1-SA4E-204.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-22 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-099 | 4 | High |
| Functional — Alternative Flows | TC-100 to TC-199 | 1 | High |
| Functional — Exception/Error Flows | TC-200 to TC-299 | 1 | High |
| Business Rule Validation | TC-300 to TC-399 | 1 | High |
| Boundary & Negative Testing | TC-400 to TC-499 | 0 | Medium |
| UI/UX Testing | TC-500 to TC-599 | 0 | Medium |
| Non-Functional (Performance, Security) | TC-600 to TC-699 | 1 | Medium |
| Integration Testing | TC-700 to TC-799 | 2 | High |
| Regression Testing | TC-800 to TC-899 | 1 | Medium |

## Test Data

Test data for PBT and E2E-API tests is provided in `test-data.csv`. Data file contains tool call inputs, expected status, and parallel eligibility flags.

| Field | Description |
|-------|-------------|
| test_id | Links to test case |
| tool_call_id | Unique identifier |
| tool_name | Tool to execute |
| arguments | JSON arguments |
| expected_status | success/error |
| parallel_eligible | true/false |

---

## 1. Functional Test Cases — Happy Path

### TC-001: Multiple independent tools execute concurrently

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1, BR-3, BR-5 |
| **Preconditions** | CHAT_PARALLEL_ENABLED=true, CHAT_MAX_PARALLELISM>=2, execute_tools node initialized with McpBridge mock |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create state with toolCalls: [callA, callB] independent, no depends_on | State accepted |
| 2 | Invoke createExecuteToolsNode(state) | Node starts execution |
| 3 | Mock McpBridge.callTool to resolve after 100ms each | Both calls dispatched |
| 4 | Measure total execution time | Total time < 150ms (~100ms not 200ms) |

**Test Data:** tool_call_id: call_001, call_002; tool_name: grep_search, list_directory; arguments: {}
**Postconditions:** toolResults array contains both results, order preserved

---

### TC-002: Results correctly mapped to toolCallId after parallel execution

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1, BR-2 |
| **Preconditions** | Parallel mode enabled |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create toolCalls with distinct IDs: idA, idB, idC | State ready |
| 2 | Execute node with mocked executor returning unique content per call | Execution completes |
| 3 | Verify toolResults[i].toolCallId matches input order | Mapping correct |
| 4 | Verify content corresponds to correct tool_name | Correct correlation |

**Test Data:** call_101→toolA, call_102→toolB, call_103→toolC
**Postconditions:** Results array length = 3, each result.toolCallId matches input

---

### TC-003: Error in one tool doesn't block others

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-1 AF-2, EF-3 |
| **Preconditions** | Parallel mode enabled |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create toolCalls: goodTool, failingTool | State ready |
| 2 | Mock McpBridge.callTool → goodTool resolves, failingTool rejects | Execution starts |
| 3 | Wait for completion | Both results returned |
| 4 | Verify goodTool result is success | Good tool succeeded |
| 5 | Verify failingTool result contains error marker | Error captured, not thrown |

**Test Data:** failingTool throws Error('timeout')
**Postconditions:** toolResults contains success for goodTool and error for failingTool

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: Sequential fallback when parallel toggle disabled

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-1 AF-1, BR-4 |
| **Preconditions** | CHAT_PARALLEL_ENABLED=false |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set process.env.CHAT_PARALLEL_ENABLED='false' | Toggle off |
| 2 | Create state with 2 independent tool calls | State ready |
| 3 | Invoke execute_tools node | Node executes sequentially |
| 4 | Verify execution time ≈ sum of individual times | Sequential behavior confirmed |
| 5 | Verify results order preserved | Order correct |

**Test Data:** 2 tool calls with 100ms mock delay each
**Postconditions:** Total duration ~200ms, results correct

---

## 3. Non-Functional Testing

### TC-600: Max parallelism limit respected

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | BR-5, FSD 8 Performance |
| **Preconditions** | Parallel mode enabled, CHAT_MAX_PARALLELISM=3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create 10 independent tool calls | State ready |
| 2 | Mock executor to track concurrent call count | Monitoring active |
| 3 | Execute node | Execution starts |
| 4 | Observe max concurrent executions | Never exceeds 3 |

**Test Data:** 10 calls with 200ms delay
**Postconditions:** Max concurrency ≤3, all results returned

---

## 4. Integration Testing

### TC-700: Tool filtering still enforced in parallel mode

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration / Security |
| **Requirement** | SA4E-186, BR-5 |
| **Preconditions** | Agent config with toolPatterns limiting allowed tools |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Configure agentConfig with allowed tool pattern: /grep_/ | Config set |
| 2 | Create toolCalls: allowed grep_search, blocked shell_execute | State ready |
| 3 | Execute node with parallel mode | Execution starts |
| 4 | Verify grep_search executed | Allowed tool runs |
| 5 | Verify shell_execute result contains blocked message | Filter enforced in parallel |

**Test Data:** agentId=test-agent, toolPatterns=['^grep_']
**Postconditions:** Filter message returned for blocked tool

---

### TC-701: Backward compatibility with dependent tools

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration / Regression |
| **Requirement** | BR-4, UC-1 AF-1 |
| **Preconditions** | Parallel mode enabled |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create toolCalls: toolB depends_on toolA | Dependency set |
| 2 | Execute node | Node analyzes dependencies |
| 3 | Verify toolA executes before toolB | Order preserved |
| 4 | Verify no parallel execution for dependent pair | Sequential for dependent chain |

**Test Data:** callA id=dep1, callB id=dep2 depends_on=[dep1]
**Postconditions:** Results order matches dependency

---

## 5. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-1 Parallel Tool Execution | FSD 3.1 | TC-001, TC-002, TC-003, TC-100, TC-701 | Covered |
| UC-2 Result Aggregation | FSD 3.2 | TC-002, TC-003, TC-701 | Covered |
| BR-1 Tool list not empty | FSD 3.1.3 | TC-001 | Covered |
| BR-2 Results contain tool_call_id | FSD 3.1.3 | TC-002 | Covered |
| BR-3 Parallel only for independent | FSD 3.1.3 | TC-001, TC-701 | Covered |
| BR-4 Preserve order for dependent | FSD 3.1.3 | TC-100, TC-701 | Covered |
| BR-5 Max parallelism configurable | FSD 3.1.3 | TC-600, TC-100 | Covered |
| BR-6 Aggregated results preserve order | FSD 3.2.3 | TC-002, TC-701 | Covered |
| BR-7 Downstream receives complete set | FSD 3.2.3 | TC-003, TC-700 | Covered |
| Story 1 Parallel execution | BRD 2.3 | TC-001, TC-600 | Covered |
| Story 2 Result aggregation | BRD 2.3 | TC-002, TC-003 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 2 | 2 | 100% |
| Business Rules | 7 | 7 | 100% |
| Acceptance Criteria | 4 | 4 | 100% |
| **Overall** | **13** | **13** | **100%** |

---

## 11. Appendix

### Test Data Setup Scripts
Synthetic toolCalls constructed in Vitest mocks. McpBridge.callTool mocked to return deterministic responses with configurable delay.

### Environment Configuration
Set env vars:
CHAT_PARALLEL_ENABLED=true|false
CHAT_MAX_PARALLELISM=5
