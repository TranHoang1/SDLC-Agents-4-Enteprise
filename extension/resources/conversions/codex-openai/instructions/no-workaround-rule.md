# No Workaround Rule — Fix Root Cause

## ⛔ Absolute Rule

When detecting design issues:
1. NEVER use workaround/fallback/hack to bypass the problem
2. MUST analyze root cause before writing fix code
3. MUST involve SA + TA + DEV if issue involves:
   - 2 modules using different data sources for same entity
   - Interface contract inconsistency
   - Auth/Authz logic scattered
   - Duplicate logic in multiple places

## Procedure

### Step 1: Identify problem
- Describe clearly: "Module A calls X, Module B calls Y — same entity, different results"

### Step 2: SA analyzes architecture
- Why different data sources? Original intent? Correct solution (single source of truth)?

### Step 3: TA proposes technical fix
- Specific files to change, interfaces to unify, migration plan

### Step 4: DEV implements correct fix
- Fix root cause, not symptom
- Verify: same input → same output across both modules

## ⛔ Forbidden

```typescript
// ❌ WORKAROUND — fallback when UserService not found
const user = userService.getUserByEmail(email);
if (!user) { const roles = extractRolesFromJwt(headers); } // hidden bug

// ❌ WORKAROUND — query 2 tables
const result = (await tableA.findById(id)) ?? (await tableB.findById(id)); // design flaw
```

## ✅ Correct

```typescript
// Single UserRepository for both auth and user management
class AdminAuthMiddleware {
  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async validateAdmin(headers: Map<string, string>): Promise<string> {
    const email = extractEmail(headers);
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new PermissionDeniedException("User not found");
    return email;
  }
}
```

## Pre-fix checklist

- [ ] Root cause identified?
- [ ] Fix creates single source of truth?
- [ ] Fix doesn't break other modules?
- [ ] Data migration needed?
- [ ] Test: same input → same output at all entry points?