# Deployment Guide — SA4E-119: ECC Feature Parity

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-119 |
| Phase | 4.5 — DevOps Pipeline Setup |
| Type | Epic-level foundation (not full deployment) |
| Branch | SA4E-119 |

---

## 1. Pre-Deployment Checklist

- [ ] Node.js >= 22.x installed
- [ ] backend/ dependencies installed (npm ci)
- [ ] .code-intel/knowledge.db exists (SQLite database)
- [ ] Feature flags configured (env vars or defaults)
- [ ] All 5 migrations reviewed (dry-run passed)

---

## 2. Migration Execution

### 2.1 Validate (Dry Run)

```bash
cd backend
npx tsx scripts/migrate-sa4e-119.ts --dry-run
```

Expected output: lists 5 migrations that WOULD be applied.

### 2.2 Apply Migrations

```bash
cd backend
npx tsx scripts/migrate-sa4e-119.ts
```

### 2.3 Verify

```bash
sqlite3 .code-intel/knowledge.db ".tables"
```

---

## 3. Feature Flag Configuration

### 3.1 Defaults (no action needed)

All stable features are ON by default. Experimental features (council, adversarialReview, modelTiering) are OFF.

### 3.2 Override via Environment

| Env Variable | Default | Feature |
|-------------|---------|---------|
| SA4E_FF_CONFIDENCE_SCORING | true | Confidence + Instincts |
| SA4E_FF_GATEGUARD | true | Command blocking |
| SA4E_FF_AGENTSHIELD | true | Config scanning |
| SA4E_FF_SKILL_PACKS | true | Skill pack system |
| SA4E_FF_MODEL_TIERING | false | Multi-model routing |
| SA4E_FF_CONTEXT_COMPACTION | true | Post-phase compaction |
| SA4E_FF_PATTERN_EXTRACTION | true | Auto pattern extraction |
| SA4E_FF_COUNCIL | false | Multi-voice decisions |
| SA4E_FF_ADVERSARIAL_REVIEW | false | GAN-style review |

---

## 4. Rollback Plan

### 4.1 Migration Rollback

Migrations are non-destructive (ADD COLUMN, CREATE TABLE). To rollback:

- DROP TABLE for V119_02 through V119_05
- V119_01: SQLite lacks DROP COLUMN — use feature flags to ignore columns
- DELETE from _migrations to allow re-run

### 4.2 Feature Rollback

Set all SA4E_FF_* env vars to false to disable all new features without code changes.

---

## 5. Post-Deployment Verification

| Check | Command | Expected |
|-------|---------|----------|
| Build passes | npm run build | Exit 0 |
| Unit tests pass | npm run test:unit | All green |
| Migration applied | npx tsx scripts/migrate-sa4e-119.ts | 0 new, 5 skipped |
| Server starts | npm run dev | Listening on port |

---

## 6. Notes

- Epic-level foundation only. Individual stories extend as needed.
- No production secrets in any configs.
- Existing CI pipeline (ci.yml) covers build + test.
- SQLite WAL mode enabled during migration for concurrent read safety.
