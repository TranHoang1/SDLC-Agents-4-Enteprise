# STC.md — SA4E-101 Test Cases

| ID | Scenario | Precondition | Steps | Expected |
|----|----------|--------------|-------|----------|
| TC-01 | Multi-tenant isolation | Two users | Start index for user A project X, query as user B | B sees idle |
| TC-02 | Persistence after restart | Index running | Restart backend | Status = interrupted |
| TC-03 | Checksum skip | File unchanged | Run index twice | Second run skips file |
| TC-04 | Cancel & replace | Two requests | Start index then trigger again | First cancelled |
| TC-05 | Cleanup scheduler | Completed op >1h | Wait scheduler | Record removed |

