---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# No Workaround Rule — Fix Root Cause, Not Symptoms

## ⛔ Absolute Rule

When detecting design issues (architecture mismatch, data inconsistency, module conflict):

1. **NEVER** use workaround/fallback/hack to bypass the problem
2. **MUST** analyze root cause before writing fix code
3. **MUST** involve SA + TA + DEV if issue involves:
   - 2 modules using different data sources for same entity
   - Interface contract inconsistency between modules
   - Auth/Authz logic scattered across modules
   - Duplicate logic in multiple places

## Procedure when detecting design flaw

### Step 1: Identify problem
- Describe clearly: "Module A calls X, Module B calls Y — same entity, different results"
- Determine impact

### Step 2: SA analyzes architecture
- Why different data sources?
- What was original design intent?
- Correct solution (single source of truth)?

### Step 3: TA proposes technical fix
- Specific files to change, interfaces to unify
- Migration plan if schema/data changes needed

### Step 4: DEV implements correct fix
- Fix root cause, not symptom
- Verify with test: same input → same output across both modules

## ⛛ Forbidden patterns

```typescript
// ❌ WORKAROUND — fallback when UserService not found
const user = userService.getUserByEmail(email);
if (!user) {
  const roles = extractRolesFromJwt(headers);  // ← Hidden bug
}

// ❌ WORKAROUND — query 2 tables because data location unknown
const result = (await tableA.findById(id)) ?? (await tableB.findById(id));  // ← Design flaw
```

## ✅ Correct pattern

```typescript
// ✅ FIX ROOT CAUSE — single UserRepository for both auth and user management
class AdminAuthMiddleware {
  constructor(
    private readonly userRepository: UserRepository,  // Same instance as auth module
  ) {}

  async validateAdmin(headers: Map<string, string>): Promise<string> {
    const email = extractEmail(headers);
    const user = await this.userRepository.findByEmail(email);  // Single source of truth
    if (!user) throw new PermissionDeniedException("User not found");
    return email;
  }
}
```

## Pre-fix checklist

- [ ] Root cause clearly identified?
- [ ] Fix creates single source of truth?
- [ ] Fix doesn't break other modules?
- [ ] Data migration needed?
- [ ] Test verifies same input → same output at all entry points?
