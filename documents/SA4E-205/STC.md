# Software Test Cases (STC)

## SA4E-205

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| TC01 | Parallel execution | 1. Load pipeline with phases A,B independent 2. Run pipeline | A and B complete concurrently, total time < sequential |
| TC02 | State merge | 1. Run parallel phases returning state keys 2. Join | Merged state contains both keys |
| TC03 | Error isolation | 1. Phase A fails, Phase B succeeds 2. Join | B result present, error recorded in state.errors |
| TC04 | Dependency respect | 1. Phase C depends on A 2. Run pipeline | C runs after A, not parallel |
