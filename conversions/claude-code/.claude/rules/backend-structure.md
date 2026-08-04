---
paths: "backend/src/**"
---

# Backend Code Structure Standard

## Architecture
- `backend/src/server/` — Hono HTTP + MCP layer (routes, middleware, mcpServer)
- `backend/src/modules/` — Business logic per domain (code-intel, kb-graph, memory, orchestration, pega, analytics, web)
- `backend/src/di/` — Dependency Injection container
- `backend/src/shared/` — Shared types, schemas, utilities

## Code Placement

### backend/src/server/
- Routes, Middleware, MCP handlers (no business logic)

### backend/src/modules/{domain}/
- Interfaces, zod schemas, types, enums
- Business logic implementations
- Services (validation, formatting, state)

### backend/src/shared/
- Shared DTOs, types, utility functions

## Package Convention
```
backend/src/modules/{domain}/
├── {Domain}Types.ts
├── {Domain}Schema.ts
├── {Domain}Service.ts
└── index.ts
```

## Rules
- Each domain: Types + Schema + Service in SEPARATE files
- Route groups: 1 file per resource in `server/routes/`
- DI: Always inject via container, never create instances in routes
- Data: Validate with zod schemas, use `safeParse` for external sources
- Error handling: Throw validation errors (Hono error handler → 400), use Pino logger

## ⛔ Backend API UX Rules
- NEVER return empty result without explanation
- Error responses: `{error, details, action}` structure
- NEVER fail silently
- Validation errors MUST be specific per field
- Long operations MUST have status tracking
- Jira API: Use `/rest/api/3/search/jql` (NOT deprecated `/rest/api/3/search`)
