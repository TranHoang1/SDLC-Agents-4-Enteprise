**Có, chắc chắn phải cập nhật BRD.**

Trong quy trình phát triển phần mềm (SDLC), BRD (Business Requirements Document) là tài liệu gốc mang tính cam kết về phạm vi và giá trị nghiệp vụ. Khi chúng ta đã quyết định chuyển đổi kiến trúc sang **Backend-Driven State** và đưa lõi LangGraph vào diện cần tái cấu trúc (Refactoring), nếu không cập nhật BRD, dự án sẽ gặp phải lỗi sai lệch phạm vi (Scope Creep/Misalignment) nghiêm trọng giữa đội ngũ Business và đội ngũ DEV.

Dưới đây là 3 điểm cốt lõi cần phải sửa đổi để nâng cấp BRD lên phiên bản 3.0:

### 1. Cập nhật lại Phạm vi Dự án (Scope & Out of Scope)

Sự thay đổi về mặt kiến trúc khiến giới hạn của dự án thay đổi hoàn toàn:

* **Chuyển từ Out of Scope sang In Scope:** Hạng mục *Backend LangGraph pipeline* bắt buộc phải bị loại bỏ khỏi danh sách `1.3 Out of Scope`.


* **Bổ sung vào In Scope:** Cần ghi rõ trong mục `1.2 Scope` rằng dự án sẽ bao gồm việc thiết lập cơ sở dữ liệu SQLite cục bộ (Checkpointer) và tái cấu trúc đồ thị tác vụ của LangGraph để hỗ trợ tính năng ngắt luồng (Human-in-the-loop).



### 2. Bổ sung User Story mới (Trải nghiệm Đa môi trường)

BRD v2.0 hiện chỉ có 8 User Stories tập trung vào các tính năng như Actionable Diff, Context Badge, hay Permission Guard. Cần bổ sung thêm một Story thứ 9 để bọc lót cho Use Case phục hồi dữ liệu (Hydration):

* **STORY 9 (Multi-IDE Context Sync):** *"As a Developer, I want my active chat session and context to synchronize in real-time across VSCode, Kiro IDE, and AntiGravity, so that I can switch development environments seamlessly without losing my conversation history."*

### 3. Hiệu chỉnh Sơ đồ Luồng Nghiệp vụ (High Level Process Map)

Luồng xử lý 9 bước (Step 1 đến Step 9) hiện tại đang mặc định hệ thống chỉ kích hoạt khi Developer gõ Prompt.

* **Điều chỉnh:** Bổ sung ngay tại **Step 1**, hệ thống Chat UI khi vừa được mở lên phải tự động dò tìm định danh phiên làm việc (`thread_id`) và tải lại toàn bộ lịch sử trò chuyện từ Backend trước khi người dùng kịp tương tác.

---

Bạn có muốn tôi phát hành ngay bản tóm tắt BRD v3.0 với các điểm thay đổi này để chính thức khép kín bộ tài liệu thiết kế (BRD, FSD, TDD) trước khi chuyển sang giai đoạn lập trình thiết lập cấu trúc Svelte + Vite không?