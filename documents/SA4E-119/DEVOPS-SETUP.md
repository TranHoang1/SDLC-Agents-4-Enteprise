# DevOps Pipeline Setup — SA4E-119

## Summary

Foundation CI/CD setup for the ECC Feature Parity epic (12 features). Adds migration runner, feature flags, and test automation config on top of existing infrastructure.

---

## What Already Exists (NOT modified)

| Asset | Location | Status |
|-------|----------|--------|
| CI workflow | `.github/workflows/ci.yml` | Runs build, unit, integration, e2e-api |
| Dockerfile | `backend/Dockerfile` | Production build |
| docker-compose | `backend/docker-compose.yml` | Local dev environment |
| Pre-commit hooks | `backend/.huskyrc.json` + `.lintstagedrc.json` | lint-staged: eslint + tsc + vitest related |
| Existing migrations | `backend/scripts/run-migrations.ts` | PostgreSQL migrations (SA4E-44) |
| Vitest config | `backend/package.json` scripts | test, test:unit, test:integration, test:e2e-api |

---

## What Was Created

### 1. Migration Runner — `backend/scripts/migrate-sa4e-119.ts`

SQLite migration runner for the 5 new tables/alterations defined in TDD Section 4:

| Migration | Description |
|-----------|-------------|
| V119_01 | Add `corroboration_count`, `last_refreshed_at`, `confidence_source` to `knowledge_entries` |
| V119_02 | Create `instincts` table (project-scoped re-ranking rules) |
| V119_03 | Create `gateguard_audit` table (command audit log) |
| V119_04 | Create `skill_packs` table (pack registry) |
| V119_05 | Create `pattern_extractions` table (pattern tracking) |

**Usage:**
```bash
# Run migrations against local knowledge.db
npx tsx scripts/migrate-sa4e-119.ts

# Dry run (preview only)
npx tsx scripts/migrate-sa4e-119.ts --dry-run

# Specify custom DB path
npx tsx scripts/migrate-sa4e-119.ts --db /path/to/knowledge.db
```

**Design decisions:**
- Uses `better-sqlite3` (matches existing backend DB layer)
- Tracks applied migrations in `_migrations` table (same pattern as run-migrations.ts)
- Each migration runs in a transaction — fail = rollback
- Idempotent: skips already-applied migrations
- Supports `--dry-run` for CI validation

---

### 2. Feature Flags — `backend/src/config/feature-flags.ts`

Interface + loader for 9 feature flags defined in TDD Section 10.1:

| Flag | Default | Domain |
|------|---------|--------|
| `confidenceScoring` | `true` | Knowledge Enhancement |
| `gateguard` | `true` | Security and Safety |
| `agentshield` | `true` | Security and Safety |
| `skillPacks` | `true` | Developer Productivity |
| `modelTiering` | `false` | Context Management |
| `contextCompaction` | `true` | Context Management |
| `patternExtraction` | `true` | Knowledge Enhancement |
| `council` | `false` | Quality Assurance (experimental) |
| `adversarialReview` | `false` | Quality Assurance (experimental) |

**Override priority:** `ENV vars > config overrides > defaults`

**Environment variables:** `SA4E_FF_CONFIDENCE_SCORING`, `SA4E_FF_GATEGUARD`, etc.

**Usage in modules:**
```typescript
import { isFeatureEnabled, loadSA4E119Flags } from '../config/feature-flags';

// Single check
if (isFeatureEnabled('gateguard')) {
  // register GateGuard tools
}

// Load all flags at once
const flags = loadSA4E119Flags();
```

---

## What Already Covers the Requirements

### Test Automation (Vitest + fast-check)

The existing CI already runs:
- `npm run test:unit` — Vitest unit tests (PBT via fast-check already in devDependencies)
- `npm run test:integration` — Integration tests
- `npm run test:e2e-api` — E2E API tests

**No additional config needed.** Stories will add test files that Vitest auto-discovers.

### Pre-commit Hooks

Already configured via `.huskyrc.json` + `.lintstagedrc.json`:
- ESLint with `--max-warnings 0`
- TypeScript `--noEmit` check
- `vitest related --run` (runs tests related to staged files)

### Property-Based Testing (PBT)

`fast-check` v4.9.0 is already in devDependencies. Vitest integrates with fast-check natively. No additional config needed — stories will write `fc.assert(fc.property(...))` in test files.

---

## CI Enhancement Recommendation (for individual stories)

Each story should add its own workflow job if needed. Suggested addition to `ci.yml`:

```yaml
  # Add to existing ci.yml when SA4E-119 stories begin
  migrations-check:
    name: SA4E-119 Migration Validation
    runs-on: ubuntu-latest
    needs: [backend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
        working-directory: backend
      - run: npx tsx scripts/migrate-sa4e-119.ts --dry-run
        working-directory: backend
```

This is NOT added now (epic-level foundation only). Individual stories will integrate as they implement.

---

## Branch Strategy

- All SA4E-119 work on branch: `SA4E-119`
- Sub-stories branch from: `SA4E-119` (e.g., `SA4E-119-confidence`)
- Merge back to `SA4E-119` before final merge to master

---

## File Index

| File | Type | Purpose |
|------|------|---------|
| `backend/scripts/migrate-sa4e-119.ts` | New | SQLite migration runner for 5 DDL scripts |
| `backend/src/config/feature-flags.ts` | New | Feature flag interface, defaults, env-var loader |
| `documents/SA4E-119/DEVOPS-SETUP.md` | New | This document |
