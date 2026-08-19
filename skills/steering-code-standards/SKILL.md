---
name: steering-code-standards
description: TypeScript-specific code standards. Activate when editing any .ts file.
---

# Code Standards

## ⛔ Giới hạn kích thước bắt buộc

### File: tối đa 200 dòng
- Mỗi file `.ts` KHÔNG ĐƯỢC vượt quá 200 dòng (bao gồm comments, blank lines)
- Nếu file vượt 200 dòng → tách thành nhiều file theo trách nhiệm (SRP)
- Ví dụ: `IntegrationsPage.ts` (>200 dòng) → tách thành `IntegrationsPage.ts` (render + events) + `IntegrationsConfigModal.svelte` (modal logic) + `IntegrationsTestLink.ts` (test connection logic)

### Hàm: tối đa 20 dòng
- Mỗi function KHÔNG ĐƯỢC vượt quá 20 dòng (không tính signature và closing brace)
- Nếu hàm vượt 20 dòng → tách thành nhiều hàm nhỏ hơn với tên mô tả rõ ràng
- Ví dụ: `renderProviderCards()` (>20 dòng) → tách thành `renderProviderCards()` + `createProviderCard(provider)` + `bindCardEvents(card, provider)`

## ⛔ Tách biệt Model và Processing

### Model types (zod schemas, DTOs, enums) phải ở thư mục riêng
```
# ❌ CẤM — Model và logic chung file
// IntegrationsPage.ts
export function render() { ... }
export const ProviderInfoSchema = z.object({ ... });  // ← CẤM
export const TestResultSchema = z.object({ ... });    // ← CẤM

# ✅ ĐÚNG — Model ở thư mục riêng
// models/ProviderInfo.ts
import { z } from "zod";
export const ProviderInfoSchema = z.object({ ... });

// models/TestResult.ts
import { z } from "zod";
export const TestResultSchema = z.object({ ... });

// pages/IntegrationsPage.ts
import { ProviderInfoSchema } from "../models/ProviderInfo";
import { TestResultSchema } from "../models/TestResult";
export function render() { ... }
```

### Quy tắc thư mục
- `models/` — zod schemas, types, DTOs, enums
- `pages/` — Page controllers (UI logic, event binding)
- `components/` — Reusable UI components (Shell, Sidebar, Navbar)
- `api/` — HTTP client, API calls
- `router/` — Navigation logic
- `charts/` — SVG chart renderers
- `services/` — Business logic helpers (validation, formatting, state management)

## ⛔ OOP Design Patterns bắt buộc

### Sử dụng design patterns phù hợp

| Pattern | Khi nào dùng | Ví dụ |
|---------|-------------|-------|
| Strategy | Nhiều cách xử lý cùng loại dữ liệu | `ProviderConfigStrategy` cho Ollama/Gemini/LMStudio config |
| Observer | Thông báo thay đổi state | `ScanStatusObserver` cho polling updates |
| Factory | Tạo objects phức tạp | `ProviderCardFactory.create(provider)` |
| Template Method | Quy trình chung với bước tùy biến | `BasePage.render()` → `onBind()` → `onLoad()` |
| Facade | Đơn giản hóa subsystem phức tạp | `ApiClient` facade cho HTTP calls |

### Ví dụ Template Method cho Pages
```typescript
// BasePage.ts
export abstract class BasePage {
    protected abstract onBind(): void;
    protected abstract onLoad(): Promise<void>;

    async render(): Promise<void> {
        await this.cleanup();
        this.onBind();
        await this.onLoad();
    }

    async cleanup(): Promise<void> {}
}

// AnalysisPage.ts
export class AnalysisPage extends BasePage {
    protected onBind(): void { this.bindDiveReportsButton(); }
    protected async onLoad(): Promise<void> {
        await this.loadAnalysisData();
        await this.loadScanStatus();
    }
    async cleanup(): Promise<void> { this.cancelPollingJobs(); }
}
```

## ⛔ SOLID Principles bắt buộc

### S — Single Responsibility Principle
- Mỗi class/function chỉ có MỘT lý do để thay đổi
- Page controller chỉ lo render + events, KHÔNG chứa business logic phức tạp
- Business logic (validation, formatting, calculations) tách vào `services/`

```typescript
# ❌ CẤM — Component chứa validation logic
// SettingsPage.svelte
function isValidUrl(url: string): boolean { ... }           // ← Business logic
function maskSensitiveField(value: string): string { ... }  // ← Business logic

# ✅ ĐÚNG — Tách validation vào service
// services/ValidationService.ts
export function isValidUrl(url: string): boolean { ... }

// services/MaskingService.ts
export function maskSensitiveField(value: string): string { ... }
```

### O — Open/Closed Principle
- Classes mở cho extension, đóng cho modification
- Dùng interfaces và abstract classes thay vì sửa code hiện có
- Thêm provider mới → implement interface, KHÔNG sửa switch block

### L — Liskov Substitution Principle
- Subclass phải thay thế được parent class mà không thay đổi behavior
- Tất cả Pages implement cùng interface/abstract class

### I — Interface Segregation Principle
- Interfaces nhỏ, tập trung vào một nhóm chức năng
- KHÔNG tạo "god interface" với quá nhiều methods

```typescript
# ❌ CẤM
interface PageController {
    render(): void; cleanup(): void; loadData(): void
    bindEvents(): void; handleError(): void; showToast(): void
    startPolling(): void; stopPolling(): void
}

# ✅ ĐÚNG
interface Renderable { render(container: HTMLElement): void }
interface Cleanable { cleanup(): void }
interface Pollable { startPolling(): void; stopPolling(): void }
```

### D — Dependency Inversion Principle
- Depend on abstractions, not concretions
- Page controllers depend on interfaces (ApiClient interface), not implementations
- Dễ dàng mock cho testing

## Checklist khi viết/review TypeScript code

- [ ] File ≤ 200 dòng?
- [ ] Mỗi hàm ≤ 20 dòng?
- [ ] Model types ở thư mục `models/` riêng?
- [ ] Không có business logic trong page controllers?
- [ ] Sử dụng design pattern phù hợp?
- [ ] Tuân thủ SOLID?
- [ ] Interfaces cho dependencies?


## ⛔ Serialization — zod schema validation

### LUÔN dùng zod `safeParse()` khi validate protocol/API communication

```typescript
// ❌ CẤM — Type cast không validate, fields mặc định bị bỏ qua
const payload = JSON.parse(raw) as InitializeParams;
// Kết quả: THIẾU "jsonrpc": "2.0" — runtime không kiểm tra

// ✅ ĐÚNG — Validate bằng zod schema, defaults được áp dụng
const parsed = InitializeParamsSchema.safeParse(JSON.parse(raw));
if (parsed.success) {
    const payload = parsed.data; // ĐẦY ĐỦ, đã validate
} else {
    throw new Error(`Invalid protocol payload: ${parsed.error.message}`);
}
```

### Quy tắc cụ thể

1. **Protocol communication** (JSON-RPC, MCP, WebSocket): PHẢI validate bằng zod schema `safeParse()` — protocol specs yêu cầu tất cả fields phải có mặt, dùng `.default()` cho optional fields
2. **API responses** (REST endpoints): NÊN dùng zod schema — frontend cần biết shape chính xác
3. **Internal serialization** (DB, cache): Có thể dùng `z.record(z.string(), z.unknown())` nếu muốn flexible
4. **Types với default values**: Nếu field có default value và PHẢI xuất hiện trong output → dùng `.default()` trong schema
5. **Shared schema instance**: Ưu tiên export 1 shared schema instance per module thay vì tạo mới mỗi lần

### Checklist khi tạo zod schema

- [ ] Dùng `safeParse()` (không `parse()`) khi validate từ external input?
- [ ] Xử lý `parsed.error` và thông báo cụ thể cho user?
- [ ] Dùng `.default()` cho fields có giá trị mặc định?
- [ ] `z.record`/`z.unknown()` chỉ khi cần data không chuẩn?
- [ ] Không định nghĩa schema inline trong function — export từ file `models/` dùng chung?
