# Release Notes — SA4E-119: ECC Feature Parity (Pipeline Setup)

## Version: Pre-release (Pipeline Foundation)

**Date:** 2026-08-16
**Branch:** SA4E-119
**Type:** Infrastructure / DevOps Setup

---

## What's New

### Database Migrations (5 scripts)

New SQLite migration runner for the ECC Feature Parity epic:

- **V119_01** — Confidence scoring fields added to knowledge_entries
- **V119_02** — Instincts table for project-scoped search re-ranking
- **V119_03** — GateGuard audit log for command blocking history
- **V119_04** — Skill packs registry for steering pack management
- **V119_05** — Pattern extractions tracking for continuous learning

### Feature Flags (9 flags)

Runtime feature toggle system with environment variable overrides:

| Enabled by Default | Disabled by Default |
|-------------------|---------------------|
| Confidence Scoring | Model Tiering |
| GateGuard | Council (experimental) |
| AgentShield | Adversarial Review (experimental) |
| Skill Packs | |
| Context Compaction | |
| Pattern Extraction | |

### Infrastructure Verified

- Existing CI/CD pipeline covers all test levels (PBT, UT, IT, E2E-API)
- Pre-commit hooks already configured (ESLint + tsc + Vitest related)
- fast-check (PBT) already in devDependencies
- No changes to Dockerfile or docker-compose required at this stage

---

## Breaking Changes

None. All changes are additive (new tables, new columns with defaults, new config file).

---

## Migration Required

Run before starting any SA4E-119 story implementation:

```bash
cd backend
npx tsx scripts/migrate-sa4e-119.ts
```

---

## Known Limitations

- V119_01 adds columns via ALTER TABLE. SQLite cannot DROP COLUMN for rollback — use feature flags instead.
- Model Tiering requires multi-model API configuration not included in this setup.
- Council and Adversarial Review are experimental and disabled by default.

---

## Files Added

| File | Purpose |
|------|---------|
| backend/scripts/migrate-sa4e-119.ts | SQLite migration runner |
| backend/src/config/feature-flags.ts | Feature flag interface + loader |
| documents/SA4E-119/DEVOPS-SETUP.md | DevOps setup summary |
