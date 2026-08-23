# Software Test Cases (STC)

## SA4E-189: Hot-Reload System — Extension Agentics

---

## Test Case Catalog

| ID | Title | Preconditions | Steps | Expected Result | Priority |
|----|-------|---------------|-------|----------------|----------|
| TC-001 | Agent file create triggers UI refresh | Extension active, workspace with `.code-intel/agents/` | 1. Create new `agents/new.md`<br>2. Wait 350ms | Agent appears in Chat Panel list | Critical |
| TC-002 | Agent file modify triggers UI refresh | Agent exists | 1. Modify `agents/existing.md`<br>2. Wait 350ms | Agent list refreshes, no error | Critical |
| TC-003 | Agent file delete triggers UI refresh | Agent exists | 1. Delete `agents/existing.md`<br>2. Wait 350ms | Agent removed from list | Critical |
| TC-004 | Steering file change triggers UI refresh | Extension active, `.code-intel/steering/` exists | 1. Modify `steering/rule.md`<br>2. Wait 350ms | Steering list updates | Critical |
| TC-005 | Hooks/Skills watcher logs reload | Extension active | 1. Modify `hooks/*.md` or `skills/*.md`<br>2. Wait 350ms | Watcher logs reload, no crash | High |
| TC-006 | Debounce timing | Extension active | 1. Rapidly edit file 3x within 1s<br>2. Wait 350ms | Only one refresh occurs | High |
| TC-007 | Watcher dispose on close | Chat panel open | 1. Close chat panel<br>2. Modify file | No refresh, no error | Medium |
| TC-008 | No workspace | No folder opened | 1. Modify file outside workspace | No crash | Low |

---

*Updated for .code-intel agentics hot-reload*
