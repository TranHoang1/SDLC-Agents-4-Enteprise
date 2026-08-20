---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---

# No Workaround Rule — Fix Root Cause, Not Symptoms

## ⛔ Quy tắc tuyệt đối

Khi phát hiện vấn đề thiết kế (architecture mismatch, data inconsistency, module conflict):

1. **KHÔNG BAO GIỜ** dùng workaround/fallback/hack để bypass vấn đề
2. **PHẢI** phân tích root cause trước khi viết code fix
3. **PHẢI** kéo SA + TA + DEV vào thảo luận nếu vấn đề liên quan đến:
   - 2 modules dùng khác data source cho cùng entity
   - Interface contract không nhất quán giữa modules
   - Authentication/Authorization logic phân tán
   - Duplicate logic ở nhiều nơi

## Quy trình khi phát hiện design flaw

### Bước 1: SM nhận diện vấn đề
- Mô tả rõ: "Module A gọi X, Module B gọi Y, cùng entity nhưng khác kết quả"
- Xác định impact: Bao nhiêu chỗ bị ảnh hưởng?

### Bước 2: SA phân tích architecture
- Tại sao 2 modules dùng khác data source?
- Design intent ban đầu là gì?
- Giải pháp đúng (single source of truth) là gì?

### Bước 3: TA đề xuất technical fix
- Cụ thể: file nào cần sửa, interface nào cần thống nhất
- Migration plan nếu cần thay đổi schema/data

### Bước 4: DEV implement fix đúng
- Fix root cause, không phải symptom
- Verify bằng test: cùng input → cùng output ở cả 2 modules

## ⛔ Ví dụ CẤM

```typescript
// ❌ WORKAROUND — bypass khi UserService không tìm thấy user
const user = userService.getUserByEmail(email);
if (!user) {
  // Fallback: trust JWT role directly
  const roles = extractRolesFromJwt(headers);
  if (roles.some((r) => r === "admin")) return email;  // ← BUG TIỀM ẨN
}

// ❌ WORKAROUND — query 2 tables vì không biết data ở đâu
const result = tableA.find(id) ?? tableB.find(id);  // ← DESIGN FLAW
```

## ✅ Ví dụ ĐÚNG

```typescript
// ✅ FIX ROOT CAUSE — thống nhất 1 UserRepository cho cả auth và user management
// Cả AuthLoginHandler và AdminAuthMiddleware dùng CÙNG repository
export class AdminAuthMiddleware {
  private readonly userRepository: UserRepository;  // ← CÙNG instance với auth module

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  validateAdmin(headers: Map<string, string>): string {
    const email = extractEmail(headers);
    const user = this.userRepository.findByEmail(email);  // ← Single source of truth
    if (!user) throw new PermissionDeniedException("User not found");
    // ...
    return email;
  }
}
```

## Checklist trước khi fix

- [ ] Root cause đã xác định rõ ràng?
- [ ] Fix có tạo single source of truth không?
- [ ] Fix có break module nào khác không?
- [ ] Có cần migration data không?
- [ ] Test verify cùng input → cùng output ở tất cả entry points?
