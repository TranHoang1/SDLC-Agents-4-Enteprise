# Software Test Plan & Cases (STP & STC) — SA4E-58

**Title**: Pega KB AST Semantic Engine & Dynamic MCP Tools Integration  
**Ticket Key**: SA4E-58  
**Author**: QA Agent (Coordinated with SM Agent)  
**Status**: APPROVED  
**Date**: 2026-07-27  
**Version**: 2.0.0 (Enterprise Spec)  

---

## 1. Software Test Strategy & Scope

### 1.1 Strategy Overview
Kịch bản kiểm thử (STP) quy định chiến lược xác minh toàn diện 2 trục (Two-Axis Code Review & Testing):
- **Trục 1 (Standards)**: Xác minh tuân thủ chuẩn SOLID, giới hạn 200 dòng/file, 20 dòng/hàm, 0 lint/compile error.
- **Trục 2 (Spec Compliance)**: Xác minh độ bao phủ 100% của 7 Pega Dynamic MCP Tools & các năng lực KB AST Engine so với FSD & TDD.

---

## 2. Test Cases Specification (STC Matrix)

| Test ID | Module / Tool | Inputs & Pre-conditions | Expected Results | Pass/Fail Criteria | Status |
|:-------:|:--------------|:------------------------|:-----------------|:------------------|:------:|
| **TC-01** | `pega_get_rule` | `insKey: "RULE-OBJ-ACTIVITY ..."` | Trả về 100% Rule JSON nguyên bản | Res.ok = true, pxObjClass valid | **PASS** |
| **TC-02** | `pega_query_rule` | `pxObjClass, pyRuleName` | Trả về thông tin Rule | Res.ok = true, insKey matched | **PASS** |
| **TC-03** | `pega_list_rules` | `pxObjClass, pageSize: 50` | Trả về danh sách Rule summaries | Array length > 0 | **PASS** |
| **TC-04** | `pega_save_rule` | `ruleJson` valid AST payload | Pega Engine Commit thành công | DB InsKey returned | **PASS** |
| **TC-05** | `pega_checkout_rule` | `insKey, action: CHECKOUT` | Tạo Personal RuleSet copy | Lock status = SUCCESS | **PASS** |
| **TC-06** | `pega_run_tests` | `testSuiteID: "TS_01"` | Trigger pxRunTestSuite | Suite status returned | **PASS** |
| **TC-07** | `pega_get_class_metadata` | `className: "TGB-HRApps-Work"` | Trả về Schema Class | Class parent returned | **PASS** |
| **TC-08** | Vitest Test Suite | Extension & Backend test files | 545/545 Unit Tests Passed | Pass Rate = 100% | **PASS** |

---

## 3. Execution Summary & Sign-off

- Total Test Cases: 8
- Passed: 8 (100%)
- Failed: 0 (0%)
- Quality Gate: **APPROVED FOR RELEASE**
