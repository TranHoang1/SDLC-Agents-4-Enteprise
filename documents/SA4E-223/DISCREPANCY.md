# Báo cáo Sai lệch FSD — SA4E-223

**Người tạo:** SA Agent
**Ngày:** 2026-08-27
**Phiên bản TDD:** 1.0
**Mục đích:** Đối chiếu FSD v1.1 với thực tế mã nguồn (Code Intelligence) để phát hiện sai lệch thiết kế.

---

## Tóm tắt

| Mức độ | Số lượng |
|--------|----------|
| Critical | 0 |
| High | 0 |
| Low | 1 |

**Kết luận:** Không có sai lệch nghiêm trọng. 5 touchpoint trong FSD khớp hoàn toàn với cấu trúc thực tế của `backend/src`. Không cần BA cập nhật FSD trước khi DEV triển khai.

---

## Chi tiết

### DISC-1: `resolver.ts` — `FALLBACK_EXTENSIONS` thiếu `.cls` / `.trigger` / `.pega` [Low]

- **FSD nói:** Không ghi rõ. Touchpoint 2 yêu cầu `resolver.ts` bổ sung danh sách salesforce-meta extensions vào `FALLBACK_EXTENSIONS`.
- **Thực tế code:** `FALLBACK_EXTENSIONS` hiện = `['.xml', '.json', '.md', '.txt', '.csv', '.yaml', '.yml']` — thiếu `.cls`, `.trigger`, `.pega`.
- **Tác động:** Không ảnh hưởng thiết kế SA4E-223. Gate 2 (`file-scanner.ts`) đã dùng `language === 'salesforce-meta'` làm điều kiện miễn trừ compound detection, nên dù metadata `.xml` không khớp `FALLBACK_EXTENSIONS` thì compound vẫn được parse đúng. Việc bổ sung chỉ tăng độ robust khi metadata bị resolve nhầm module.
- **Đề xuất:** Tạo ticket riêng (ngoài scope SA4E-223) để bổ sung `.cls` / `.trigger` / `.pega` vào `FALLBACK_EXTENSIONS` (hoặc sửa comment document trong code). KHÔNG block tiến độ.

---

## Ghi chú kiểm chứng (không phải sai lệch)

- **Không có DB:** Hệ thống dùng SQLite in-process (`backend/src/db/*`), không có schema quan hệ cần DDL. Các bảng `code_files`, `symbols`, `relationships`, `modules`, `errors`, `file_metadata` đã tồn tại; thiết kế SA4E-223 chỉ thêm cột `file_metadata.is_compound` (ALTER TABLE). Không có FSD data-model mismatch.
- **Reuse xác nhận:** `async-file-scanner.ts` kế thừa `detectLanguage` từ `file-scanner.ts` → KHÔNG cần sửa (FSD Touchpoint 1 chỉ sửa `file-scanner.ts`).
- **Canonical type:** `parsers/types.ts#ExtractedSymbol` đã có sẵn, tất cả parser mới dùng chung (SA-CONF-2).
- **Longest-match compound:** `grammar-registry.ts` đã hỗ trợ, không cần sửa cho visualforce/aura.
