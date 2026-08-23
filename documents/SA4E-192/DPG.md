# Deployment Guide — SA4E-192 Slash Commands (Tier 2)

| Ticket | SA4E-192 | Version | 1.0 |
|--------|----------|---------|-----|

## 1. Build
```
cd source && tsc -p .
```

## 2. Register Commands
Call `registerAll()` from `slash/commands/handlers.ts` at runtime startup so all 8 commands are added to `SlashMenuController`.

## 3. Verify
- Start shell, type `/help` → expect 8 commands listed.
- Type `/status` → expect counts.
- Type `/init` → expect `.code-intel/` created.

## 4. Rollback
Disable registration block to revert to Tier 1 only.

## 5. Environments
- Dev: local node.
- Prod: bundled with agent CLI release.
