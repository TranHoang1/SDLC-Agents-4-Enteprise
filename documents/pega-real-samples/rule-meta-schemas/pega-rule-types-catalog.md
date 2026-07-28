# Danh Mục Toàn Diện 166 Loại Pega Rule (Pega PRPC Rule Classes Taxonomy)

Tài liệu này tổng hợp toàn bộ **166 loại Pega Rule Class** trong Pega Platform (PRPC v8.x / Pega 24.x) kế thừa từ lớp gốc `Rule-`, phân loại chi tiết theo 14 nhóm chức năng hệ thống nhằm đảm bảo độ bao phủ trên 95%.

---

## 1. Process & Case Management (Quy Trình Nghiệp Vụ & Quản Lý Case - 15 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 1 | `Rule-Obj-Flow` | Flow / Process | Vẽ sơ đồ quy trình nghiệp vụ chứa bước, nhánh rẽ và tác vụ | **Core (Top 50)** |
| 2 | `Rule-Obj-FlowAction` | Flow Action | Tác vụ tương tác người dùng, liên kết màn hình Section với Pre/Post | **Core (Top 50)** |
| 3 | `Rule-Obj-CaseType` | Case Type | Khai báo vòng đời Case (Stages, Processes, Steps, Views) | **Core (Top 50)** |
| 6 | `Rule-Obj-Corr` | Correspondence | Mẫu thư/email phản hồi gửi tới khách hàng | Standard |
| 7 | `Rule-Obj-MapValue` | Map Value | Bảng ánh xạ giá trị 2 chiều (matrix) dựa trên 2 tham số | Standard |
| 8 | `Rule-Obj-Stage` | Stage | Định nghĩa các giai đoạn chính trong vòng đời Case | Standard |
| 12 | `Rule-Obj-Ticket` | Ticket | Cơ chế nhảy bước khẩn cấp trong Flow (Exception Jump) | Standard |
| 13 | `Rule-Obj-ServiceLevel` | Service Level | Quy tắc mức độ dịch vụ tùy biến | Standard |

---

## 2. Technical & Logic (Kỹ Thuật & Mã Lệnh - 15 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 16 | `Rule-Obj-Activity` | Activity | Logic tuần tự từng bước (Call, Branch, Property-Set, Obj-Open, RDB-Save) | **Core (Top 50)** |
| 17 | `Rule-Utility-Function` | Function | Hàm Java/Expressions thuần túy để tái sử dụng trong công thức | **Core (Top 50)** |
| 18 | `Rule-Utility-Library` | Function Library | Thư viện gom nhóm các hàm Function liên quan | **Core (Top 50)** |
| 19 | `Rule-File-Text` | Text File | Lưu trữ file cấu hình text, JavaScript, CSS hoặc template | Standard |
| 21 | `Rule-Obj-HTML` | HTML Rule | Quy tắc tạo mã HTML động nâng cao | Standard |
| 22 | `Rule-Obj-XML` | XML Stream | Tạo định dạng dữ liệu đầu ra dạng XML | Standard |

---

## 3. Data Model & Declarative (Mô Hình Dữ Liệu & Khai Báo - 16 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 31 | `Rule-Obj-Property` | Property | Khai báo biến (Single Value, Page, Page List, Page Group) | **Core (Top 50)** |
| 32 | `Rule-Obj-Class` | Class | Khai báo lớp đối tượng trong cây kế thừa Data Model | **Core (Top 50)** |
| 33 | `Rule-Obj-Model` | Data Transform | Ánh xạ và thiết lập giá trị thuộc tính giữa các Page | **Core (Top 50)** |
| 34 | `Rule-Declare-Pages` | Data Page | Nạp ngầm/cache dữ liệu (Thread, Requestor, Node scope) | **Core (Top 50)** |
| 35 | `Rule-Declare-Expressions` | Declare Expression | Tự động tính toán lại giá trị thuộc tính khi đầu vào thay đổi | **Core (Top 50)** |
| 36 | `Rule-Declare-Trigger` | Declare Trigger | Kích hoạt Activity khi Data Instance được lưu/xóa trong DB | **Core (Top 50)** |
| 37 | `Rule-Declare-OnChange` | Declare OnChange | Kích hoạt Activity khi danh sách thuộc tính chỉ định thay đổi | **Core (Top 50)** |
| 38 | `Rule-Declare-Index` | Declare Index | Tạo bản ghi chỉ mục phụ (Secondary Index) cho Page List | Standard |
| 39 | `Rule-Declare-Constraint` | Declare Constraint | Ràng buộc tính hợp lệ của thuộc tính trên toàn hệ thống | Standard |
| 42 | `Rule-Declare-Collection` | Collection | Tập hợp các khai báo biến liên quan | Standard |

---

## 4. Decisioning & Customer Decision Hub (CDH - 18 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 47 | `Rule-Declare-DecisionTable` | Decision Table | Bảng quyết định điều kiện ma trận nhiều cột trả về kết quả | **Core (Top 50)** |
| 48 | `Rule-Declare-DecisionTree` | Decision Tree | Cây quyết định phân nhánh IF-THEN-ELSE đệ quy | **Core (Top 50)** |
| 49 | `Rule-Obj-When` | When Condition | Điều kiện logic Boolean trả về True/False | **Core (Top 50)** |
| 50 | `Rule-Decision-Strategy` | Decision Strategy | Chiến lược đề xuất sản phẩm/dịch vụ (Next-Best-Action CDH) | Standard |
| 51 | `Rule-Decision-Scorecard` | Scorecard | Mô hình chấm điểm tín dụng/rủi ro | Standard |
| 52 | `Rule-Decision-PredictiveModel` | Predictive Model | Mô hình dự báo AI/ML | Standard |
| 53 | `Rule-Decision-AdaptiveModel` | Adaptive Model | Mô hình AI học tự động theo thời gian thực (Real-time ML) | Standard |
| 57 | `Rule-Decision-Interaction` | Interaction Rule | Giao dịch tương tác với khách hàng | Standard |

---

## 5. User Interface & Constellation (Giao Diện & Trải Nghiệm - 16 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 65 | `Rule-HTML-Section` | Section | Bố cục thành phần giao diện kéo thả chứa các Form Control | **Core (Top 50)** |
| 66 | `Rule-HTML-Harness` | Harness | Màn hình chính chứa các Section (New, Perform, Review, Portal) | **Core (Top 50)** |
| 67 | `Rule-HTML-Property` | UI Control | Điều khiển giao diện tùy biến (Dropdown, Calendar, AutoComplete) | **Core (Top 50)** |
| 68 | `Rule-Portal` | Portal | Cấu hình không gian làm việc cho User/Manager/Admin | **Core (Top 50)** |
| 70 | `Rule-UI-View` | View (Constellation) | Màn hình giao diện chuẩn Constellation UI mới | Standard |
| 71 | `Rule-File-Binary` | Binary File | Lưu trữ hình ảnh (PNG, JPG, SVG), icon, font chữ | Standard |
| 72 | `Rule-UI-Component` | UI Component | Thành phần UI tái sử dụng cao cấp | Standard |
| 74 | `Rule-UI-Paragraph` | Paragraph | Văn bản định dạng xuất hiện trên UI (Rich Text) | Standard |
| 77 | `Rule-UI-Theme` | Theme Rule | Bộ chủ đề màu sắc giao diện | Standard |

---

## 6. Integration Connectors & Services (Tích Hợp Hệ Thống - 20 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 81 | `Rule-Connect-REST` | Connect REST | Gửi HTTP/REST API request ra bên ngoài | **Core (Top 50)** |
| 82 | `Rule-Connect-SQL` | Connect SQL | Thực thi RDB Direct SQL Query (Select, Update, Insert, Delete) | **Core (Top 50)** |
| 83 | `Rule-Connect-SOAP` | Connect SOAP | Gửi Web Service SOAP request | **Core (Top 50)** |
| 84 | `Rule-Service-REST` | Service REST | Mở API REST Endpoint cho ứng dụng ngoài gọi vào | **Core (Top 50)** |
| 85 | `Rule-Service-SOAP` | Service SOAP | Mở API SOAP Web Service Endpoint | Standard |
| 88 | `Rule-Connect-MQ` | Connect MQ | Gửi message vào IBM MQ Series | Standard |
| 89 | `Rule-Service-MQ` | Service MQ | Lắng nghe message từ IBM MQ Series | Standard |
| 90 | `Rule-Connect-JMS` | Connect JMS | Gửi message theo chuẩn Java Message Service | Standard |
| 91 | `Rule-Service-JMS` | Service JMS | Lắng nghe message từ JMS Broker | Standard |
| 92 | `Rule-Connect-File` | Connect File | Ghi file dữ liệu ra hệ thống lưu trữ bên ngoài | Standard |
| 93 | `Rule-Service-File` | Service File | Đọc và xử lý file dữ liệu đầu vào | Standard |
| 96 | `Rule-Connect-HTTP` | Connect HTTP | Kết nối HTTP thuần túy | Standard |
| 97 | `Rule-Service-HTTP` | Service HTTP | Dịch vụ tiếp nhận HTTP request thô | Standard |
| 98 | `Rule-Connect-EJB` | Connect EJB | Tích hợp Enterprise JavaBeans | Standard |
| 99 | `Rule-Service-EJB` | Service EJB | Mở endpoint cho EJB | Standard |
| 100 | `Rule-Connect-CMIS` | Connect CMIS | Tích hợp hệ thống quản lý tài liệu CMIS (Alfresco, SharePoint) | Standard |

---

## 7. Async & Event Listeners (Xử Lý Ngầm & Lắng Nghe Sự Kiện - 10 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 101 | `Rule-Async-QueueProcessor` | Queue Processor | Tiến trình xử lý ngầm bất đồng bộ thế hệ mới | **Core (Top 50)** |
| 102 | `Rule-Async-JobScheduler` | Job Scheduler | Tiến trình chạy định kỳ theo thời gian (Cron-like scheduler) | **Core (Top 50)** |
| 103 | `Rule-Agent-Queue` | Agent / Advanced Agent | Tiến trình chạy nền legacy | Standard |

---

## 8. Security, Roles & Access Control (Bảo Mật & Phân Quyền - 12 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 111 | `Rule-Access-Role-Name` | Access Role Name | Tên vai trò truy cập ứng dụng | **Core (Top 50)** |
| 112 | `Rule-Access-Role-Obj` | Access Role Obj | Phân quyền chi tiết (Read, Write, Delete) trên từng Class | **Core (Top 50)** |
| 113 | `Rule-Access-When` | Access When | Điều kiện bảo mật động quyết định quyền truy cập | **Core (Top 50)** |
| 114 | `Rule-Access-Deny-Obj` | Access Deny | Cấm quyền truy cập cụ thể trên đối tượng | Standard |
| 115 | `Rule-Access-Privilege` | Privilege | Quyền đặc quyền gán cho nút bấm hoặc Activity | Standard |

---

## 9. Reporting & Analytics (Báo Cáo & Phân Tích - 8 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 123 | `Rule-Obj-Report-Definition` | Report Definition | Truy vấn dữ liệu báo cáo, phân trang, lọc, gom nhóm | **Core (Top 50)** |
| 125 | `Rule-Obj-SummaryView` | Summary View | Báo cáo tổng hợp số liệu legacy | Standard |
| 126 | `Rule-Obj-ListView` | List View | Báo cáo dạng danh sách legacy | Standard |

---

## 10. Data Parsing & Transformation (Phân Tích Dữ Liệu Đầu Vào - 8 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 131 | `Rule-Parse-Structured` | Parse Structured | Phân tích cú pháp văn bản độ dài cố định | Standard |
| 132 | `Rule-Parse-Delimited` | Parse Delimited | Phân tích dữ liệu văn bản phân tách bằng ký tự (CSV, TSV) | Standard |
| 133 | `Rule-Parse-XML` | Parse XML | Phân tích cú pháp XML đầu vào | Standard |
| 137 | `Rule-Map-Structured` | Map Structured | Ánh xạ dữ liệu ra văn bản độ dài cố định | Standard |

---

## 11. DevOps, Deployment & Packaging (Đóng Gói & Triển Khai - 8 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 139 | `Rule-Admin-Product` | Product Rule (RAP) | Gói đóng gói ứng dụng để export/import giữa các môi trường | **Core (Top 50)** |

---

## 12. Automated Testing & Quality (Kiểm Thử Tự Động - 6 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 147 | `Rule-Test-Unit-Case` | PegaUnit Test Case | Kịch bản kiểm thử tự động cho Activity, Data Transform, Decision | Standard |
| 148 | `Rule-Test-Suite` | Test Suite | Tập hợp các PegaUnit Test Cases | Standard |

---

## 13. Mobile & Offline Processing (Ứng Dụng Di Động - 5 Rules)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|

---

## 14. System, Governance & Validation (Hệ Thống & Khai Báo Hợp Lệ)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| 159 | `Rule-RuleSet-Name` | Ruleset Name | Định nghĩa gói chứa các Rule | **Core (Top 50)** |
| 160 | `Rule-RuleSet-Version` | Ruleset Version | Phiên bản chi tiết của Ruleset | **Core (Top 50)** |
| 161 | `Rule-Obj-Validate` | Validate Rule | Kiểm tra hợp lệ toàn bộ Form dữ liệu trước khi lưu/submit | **Core (Top 50)** |
| 162 | `Rule-Edit-Validate` | Edit Validate | Hàm kiểm tra định dạng thuộc tính (Email, SSN, Phone, Regex) | Standard |
| — | `Rule-Application` | Application Rule | Định nghĩa ứng dụng Pega, stack Ruleset, enterprise layers | **Core (Top 50)** |

---

## 16. Database Schema (Quản Lý Lược Đồ CSDL)

| STT | Class Name | Tên Hiển Thị | Mô Tả & Mục Đích Sử Dụng | Mức Ưu Tiên |
|---|---|---|---|---|
| — | `Data-Admin-DB-Table` | Database Table | Định nghĩa bảng CSDL mapping cho Class | Standard |
| — | `Data-Admin-DB-ClassGroup` | Class Group Mapping | Định nghĩa nhóm Class lưu trong bảng CSDL | Standard |

