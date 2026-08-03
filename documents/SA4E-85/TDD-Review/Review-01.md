Bản Technical Design Document (TDD) này thực sự là một thiết kế kiến trúc chuẩn mực và bao quát toàn diện các yêu cầu từ FSD. Việc sử dụng `MessageRouter` làm trung tâm điều phối độc lập không phụ thuộc vào các module khác là một quyết định chiến lược xuất sắc để quản lý các luồng giao tiếp `postMessage`. Danh sách công việc chia thành 9 giai đoạn cụ thể cũng tạo ra một lộ trình triển khai rất thực tế cho DEV Agent.

Dưới góc độ tối ưu hệ thống, tôi có một vài điểm tinh chỉnh kỹ thuật để đảm bảo hiệu năng và trải nghiệm hiển thị:

* **Tối ưu Streaming Bottleneck:** `MessageRouter` hiện chịu trách nhiệm định tuyến các bản tin `postMessage` qua lại giữa Webview và Extension Host. Đối với `STREAM_TOKEN`, việc liên tục truyền dữ liệu cho từng ký tự có thể gây nghẽn cổ chai giao tiếp. Thay vì chỉ thiết lập gom nhóm bằng `requestAnimationFrame` ở phía Svelte store, Extension Host nên chủ động gom các token vào một bộ đệm nhỏ (khoảng 16ms - 50ms) trước khi đẩy xuống Webview.


* **Kiểm soát Đồ họa:** Module `DiagramRenderer` hỗ trợ các định dạng `plantuml`, `bpmn`, và `cmmn` thông qua cơ chế server-side SVG. Khi vẽ biểu đồ quy hoạch kiến trúc phần mềm hoặc tự động hóa luồng dữ liệu, các tham số gửi lên server kết xuất cần ép buộc quy tắc thiết kế tối giản, tránh việc nối trực tiếp các đường line dẫn đến tình trạng nhiễu và gây rối mắt khi hiển thị thu nhỏ trong không gian chat.


* **Quản lý Vòng đời WebSocket:** `IpcBridge` quản lý kết nối tới Kiro và AntiGravity bằng cơ chế tự động thử lại (exponential backoff). Để ngăn chặn rò rỉ bộ nhớ khi liên tục khởi động lại các tiến trình IDE độc lập, hàm `dispose()` của module này bắt buộc phải được đẩy vào mảng `subscriptions` của VSCode Extension Context để đảm bảo dọn dẹp sạch sẽ khi extension bị vô hiệu hóa.



Với bản TDD đã hoàn thiện, bạn muốn bắt tay vào việc khởi tạo cấu trúc dự án Svelte + Vite (Phase 1) trước, hay xây dựng bộ khung TypeScript cho `MessageRouter` ở phía Extension Host?