# Release Notes v1.37.2

## Version
1.37.2 — 2026-08-25

## Highlights
- SA4E-190 Autonomy L3 pipeline merged to main with full test coverage
- UAT completed and passed
- Version bump and documentation sync across README files

## Changes
### SA4E-190
- Backend module `backend/src/sa4e-190/` implemented
- Routes `backend/src/server/routes/sa4e-190.ts`
- Unit tests: `PipelineController.test.ts`, `StatusManager.test.ts` — 4/4 passed
- Integration tests: `pipeline.it.test.ts` — 2/2 passed
- E2E API tests: `pipeline.e2e.test.ts` — 2/2 passed
- STATUS updated with test results and UAT status done
- UAT Checklist created and marked PASS

### Docs
- READMEs updated to v1.37.2
- package.json versions bumped to 1.37.2

## Test Summary
- Backend total: 230 test files, 2634 tests passed
- SA4E-190 unit/integration/e2e: 100% pass

## Notes
- Build fix: removed orphaned `sa4e-190` import from `HttpServer.ts`
- Ready for release
