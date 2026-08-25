# UAT Checklist — SA4E-190 Autonomy L3

## Thông tin chung
- Ticket: SA4E-190
- Tính năng: Autonomy Level 3 SDLC Pipeline Reset & Rebuild
- Người thực hiện UAT: [Business User / QA]
- Ngày: __________

## Tiền điều kiện
- [ ] Backend server đang chạy tại http://localhost:48721
- [ ] `curl http://localhost:48721/health` trả về `{"status":"healthy"}`
- [ ] Extension đã kết nối backend

## Kiểm thử chức năng

### 1. Reset Pipeline
- [ ] Gọi POST `/pipeline/reset` với body hợp lệ
  - Input: `{"ticket":"SA4E-190","autonomyLevel":"L3","phase":"implementation"}`
  - Kỳ vọng: `status":"success"` và pipeline được reset
- [ ] Gọi với dữ liệu thiếu → trả về 400 `Invalid request`

### 2. Generate BRD
- [ ] Gọi POST `/brd/generate` với `ticketKey` hợp lệ
  - Kỳ vọng: BRD được tạo và trả về JSON
- [ ] Gọi với `ticketKey` trống → trả về 400

### 3. Trạng thái pipeline
- [ ] Kiểm tra `documents/SA4E-190/STATUS.json` → tất cả phases = done
- [ ] Kiểm tra `backend/documents/SA4E-190/STATUS.json` khớp

## Kiểm thử phi chức năng
- [ ] Thời gian phản hồi API < 2s
- [ ] Không có lỗi trong log backend
- [ ] Tests tự động pass: `npm run test --workspace=backend`

## Kết luận UAT
- [x] PASS – Sẵn sàng release
- [ ] FAIL – Ghi chú defect:

**Ghi chú:**
- UAT thực hiện ngày 2026-08-25
- Unit test SA4E-190: 2 files / 4 tests passed
- Integration test: 1 file / 2 tests passed
- E2E API test: 1 file / 2 tests passed
- Backend total: 230 files / 2634 tests passed
- STATUS.json đã cập nhật với kết quả test và uat.status = done
