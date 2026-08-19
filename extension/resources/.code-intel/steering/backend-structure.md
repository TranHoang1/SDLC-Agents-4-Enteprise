---
inclusion: fileMatch
fileMatchPattern: "backend/**"
---

# Backend Code Structure Standard

## Kiến trúc tổng quan

Dự án sử dụng TypeScript/Node.js monorepo (npm workspaces):
- `backend/` — Code Intelligence MCP server (TypeScript + Hono + MCP SDK)
- `extension/` — VS Code/Kiro extension (TypeScript + LangGraph)
- Storage: SQLite (`better-sqlite3`, default) / PostgreSQL (`pg`)

## Quy tắc phân chia module trong backend

### src/ — Core server code
Chứa code TypeScript thuần, KHÔNG phụ thuộc framework-specific runtime:
- **Services** — `*.ts` (ví dụ: `kb-search.ts`, `embedding-service.ts`)
- **Repositories / db/** — database access layer (better-sqlite3 / pg)
- **Models / types** — `types.ts`, zod schemas cho request/response validation
- **Controllers / routes** — Hono route handlers

### servers/ — Các server phụ trợ
Chứa code phụ trợ riêng biệt:
- **fastapi/** — Python FastAPI servers (presentation-generation MCP services, `mcp_server.py`)

## Quy tắc cho Hono routes

Mỗi route group PHẢI nằm trong 1 file riêng tại `src/.../routes/`:
- File name: `{resource}.routes.ts` (ví dụ: `auth.routes.ts`, `kb.routes.ts`)
- Sử dụng `Hono` Router + `hono/factory` middleware composition
- Request/Response DTOs: Khai báo trong cùng file route hoặc file `{resource}.schemas.ts` riêng nếu phức tạp
- Tất cả routes PHẢI được mount trong app chính qua `app.route()`

## Quy tắc cho middleware

- Mỗi middleware 1 file tại `src/.../middleware/`
- Sử dụng Hono middleware pattern (`app.use()`, `createMiddleware()`)
- KHÔNG đặt business logic trong middleware — chỉ gọi services

## Dependency Injection

- Backend dùng module pattern + service classes (constructor injection)
- Không tạo instances rải rác — khởi tạo trong DI container / app bootstrap
- DB instances: khởi tạo 1 lần, truyền qua constructor

## Data validation

- Tất cả request bodies truyền qua API PHẢI có zod schema
- Sử dụng `zod` cho validation (đã có trong dependencies)
- Error response format nhất quán: `{ error, details?, action? }`

## Error handling

- Routes: Return HTTP error responses với message cụ thể (400/404/500)
- KHÔNG catch-all trong routes — để error handler middleware xử lý
- Services: Return result objects hoặc throw typed errors
- Logging: Dùng `pino` logger

## Testing conventions

- Test framework: Vitest
- Test file name: `{feature}.test.ts` hoặc `{feature}.spec.ts`
- Property/unit tests: dùng Vitest + vi.fn() mocks
- In-memory SQLite cho DB tests

---

## ⛔ QUY TẮC UX CHO BACKEND API

### Mọi API response PHẢI cung cấp đủ thông tin cho frontend hiển thị UX tốt

### KHÔNG BAO GIỜ trả về empty result mà không giải thích

```typescript
// ❌ CẤM — Trả về empty list không giải thích
if (issues.length === 0) return [];

// ✅ ĐÚNG — Trả về kèm message hoặc log entry giải thích
if (issues.length === 0) {
    await logRepository.addEntry("No tickets found in project " + projectKey);
    return { tickets: [], message: "No tickets found. Verify project has issues in Jira." };
}
```

### Error responses PHẢI có cấu trúc nhất quán

Mọi error response PHẢI dùng format:
```json
{
    "error": "Mô tả lỗi ngắn gọn",
    "details": "Chi tiết kỹ thuật (optional)",
    "action": "Hành động gợi ý cho user (optional)"
}
```

### API KHÔNG ĐƯỢC fail silently

```typescript
// ❌ CẤM — Catch exception và trả empty, frontend không biết lỗi
} catch (e) {
    return [];
}

// ✅ ĐÚNG — Log lỗi và trả response có thông tin
} catch (e) {
    logger.error(`[Feature] Operation failed: ${e.message}`);
    return c.json({
        error: "Operation failed",
        details: e.message,
    }, 500);
}
```

### Validation errors PHẢI cụ thể

```typescript
// ❌ CẤM — Message chung chung
throw new Error("Invalid input");

// ✅ ĐÚNG — Message cụ thể cho từng field
throw new Error("JIRA_HOST must be a valid URL starting with https://");
```

### Long operations PHẢI có status tracking

Mọi operation chạy lâu (scan, analysis, sync) PHẢI:
1. Trả về trạng thái ngay lập tức (202 Accepted hoặc status object)
2. Cung cấp endpoint polling để frontend theo dõi tiến trình
3. Log mỗi bước vào database để frontend hiển thị chi tiết
4. Khi hoàn tất với kết quả bất thường (0 items, partial failure) → ghi log entry giải thích nguyên nhân

### Jira API integration

- KHÔNG dùng `/rest/api/3/search` (đã deprecated, trả 410 Gone)
- Dùng `/rest/api/3/search/jql` cho search queries
- Dùng `/rest/api/3/issue/{key}` cho single issue
- Dùng `/rest/api/3/project` cho project list
- Mọi Jira API call PHẢI log kết quả (success count hoặc error message)
- Khi Jira API trả lỗi → trả response có message cụ thể cho frontend, KHÔNG trả empty silently
