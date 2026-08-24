# SA4E-208 - stream_write_file path resolution fix

## Summary
Fixed silent failure of `stream_write_file` writing to wrong CWD when using relative paths.

## Changes
- `extension/src/backend-local-tools.ts`: resolve relative paths to workspace root, fallback to cwd, enforce safety check outside workspace
- Made `vscode` import optional
- Added unit tests `TC-05/TC-06` and `stream-write-reject.test.ts`

## Test Results
- Vitest full suite: 1623 passed
- stream_write_file tests: 9/9 passed

## Deployment
No deployment required. Change verified in dev environment and pushed to main.

## Closure
QA verified, DevOps confirmed no infra impact. Ticket closed Done.
