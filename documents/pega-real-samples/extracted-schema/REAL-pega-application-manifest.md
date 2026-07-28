# Pega Enterprise Application HRAppsV2 — Complete Schema & Rule Manifest
**Source File**: `HRAppsV2_0101_20260725T190725_GMT.zip` (20.4 MB Official Pega Application Export)  
**Total Rule Items Cataloged**: 25,532 items  
**Extracted Rule Keys**: 3,397 unique rule keys  

---

## 🏛️ 1. Cấu Trúc Class & Inheritance (32 Classes Thật)

Tất cả Classes trong ứng dụng HRAppsV2 tuân theo quy tắc **Pattern Inheritance** và **Direct Inheritance** của Pega PRPC Engine:

| Class Name | Super Class (Direct/Pattern) | Class Type | Description |
|---|---|---|---|
| `TGB-HRAPPS` | `TGB` | Framework Base | Base class cho HR Enterprise |
| `TGB-HRAPPS-WORK` | `TGB-HRAPPS` | Class Group | Root Work Pool (`TGB-HRAPPS-WORK`) |
| `TGB-HRAPPS-WORK-CANDIDATE` | `TGB-HRAPPS-WORK` | Work Class | Candidate Management Case Type |
| `TGB-HRAPPS-WORK-ONBOARDING` | `TGB-HRAPPS-WORK` | Work Class | Employee Onboarding Case Type |
| `TGB-HRAPPS-WORK-EMPLOYEEEVALUATION` | `TGB-HRAPPS-WORK` | Work Class | Employee Performance Evaluation Case Type |
| `TGB-HRAPPS-WORK-PAYROLLSETUP` | `TGB-HRAPPS-WORK` | Work Class | Payroll & Direct Deposit Setup Case Type |
| `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` | `TGB-HRAPPS-WORK` | Work Class | Benefits & Insurance Selection Case Type |
| `TGB-HRAPPS-DATA` | `TGB-HRAPPS` | Abstract Data | Data layer base |
| `TGB-HRAPPS-DATA-GOALS` | `TGB-HRAPPS-DATA` | Data Class | Employee Goals data |
| `TGB-HRAPPS-DATA-OFFICE` | `TGB-HRAPPS-DATA` | Data Class | Office & Location data |
| `TGB-HRAPPS-DATA-SEATING` | `TGB-HRAPPS-DATA` | Data Class | Office Seating allocation data |
| `TGB-DATA-DENTALPLAN` | `TGB-DATA` | Data Class | Insurance Dental plan data |
| `TGB-INT-CREDITCHECK` | `TGB-INT` | Integration Class | Credit Check Connector Base |
| `TGB-INT-CREDITCHECK-CREDITCHECKREQUESTTYPE` | `TGB-INT-CREDITCHECK` | Integration DTO | Request DTO |
| `TGB-INT-CREDITCHECK-CREDITCHECKRESPONSETYPE` | `TGB-INT-CREDITCHECK` | Integration DTO | Response DTO |

---

## 📋 2. Thuộc Tính (178 Properties Thật)

Trích xuất tiêu biểu theo class:

| Class | Property | Mode / Type | Purpose |
|---|---|---|---|
| `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` | `.DentalPlan` | Page (`TGB-DATA-DENTALPLAN`) | Dental plan selection |
| `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` | `.MedicalPlanCost` | Single Value (Decimal) | Declare Expression target |
| `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` | `.DentalPlanCost` | Single Value (Decimal) | Declare Expression target |
| `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` | `.VisionPlanCost` | Single Value (Decimal) | Declare Expression target |
| `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` | `.TotalBenefitCost` | Single Value (Decimal) | Sum of Medical + Dental + Vision |
| `TGB-HRAPPS-WORK-CANDIDATE` | `.AssessmentRating` | Single Value (Text/Integer) | Rating score |
| `TGB-HRAPPS-WORK-CANDIDATE` | `.WorkSample` | Page (`Embed-Attach-File`) | Uploaded sample document |
| `TGB-HRAPPS-WORK-PAYROLLSETUP` | `.FilingStatus` | Single Value (Text) | Tax filing status |
| `DATA-PARTY` | `.pyTIN` | Single Value (Text) | Tax Identification Number |

---

## ⚡ 3. Logic & Rules Catalog Thật

### Decision Tables (`RULE-DECLARE-DECISIONTABLE`) — 6 Rules
1. `TGB-HRAPPS-WORK-CANDIDATE` ➔ `TGBSalaryApprovals`: Tính toán cấp phê duyệt lương dựa trên số tiền đề xuất.
2. `TGB-HRAPPS-WORK-ONBOARDING` ➔ `FacilitiesRouting`: Phân luồng công việc cấp phát thiết bị văn phòng.
3. `@BASECLASS` ➔ `pyGetTopicForAIFields`: AI topic routing table.

### Declare Expressions (`RULE-DECLARE-EXPRESSIONS`) — 19 Rules
1. `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` ➔ `.TotalBenefitCost`: Dynamic sum = `.MedicalPlanCost` + `.DentalPlanCost` + `.VisionPlanCost`
2. `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` ➔ `.MedicalPlanCost`
3. `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` ➔ `.DentalPlanCost`
4. `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` ➔ `.VisionPlanCost`
5. `TGB-HRAPPS-WORK-CANDIDATE` ➔ `.AssessmentRating`

### Activities (`RULE-OBJ-ACTIVITY`) — 6 Rules
1. `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` ➔ `ProcessBenefitsEnrollments`: Xử lý đăng ký bảo hiểm.
2. `TGB-HRAPPS-WORK-PAYROLLSETUP` ➔ `UploadToPaymentProcessor`: Gửi dữ liệu lương tới payment processor qua REST/SOAP.
3. `@BASECLASS` ➔ `ChangeRulesetPassword`

### Flows & Case Types (`RULE-OBJ-FLOW`) — 80 Flows & 16 Case Types
- `TGB-HRAPPS-WORK-BENEFITSENROLLMENT`: `InsuranceSelection_Flow_0`, `ReviewSelections_Flow_0`, `SelectHealthInsuranceCoverage`
- `TGB-HRAPPS-WORK-CANDIDATE`: `CollectCandidateDetails`, `Candidate`
- `TGB-HRAPPS-WORK-ONBOARDING`: `Onboarding`
- `TGB-HRAPPS-WORK-PAYROLLSETUP`: `PayrollSetup`

### Data Transforms (`RULE-OBJ-MODEL`) — 59 Data Transforms
- `DATA-PARTY-PERSON` ➔ `EmployeeParty`
- `TGB-DATA-CREDITREPORT` ➔ `CreditCheckResponse`, `SimulateCreditCheck`
- `TGB-HRAPPS-WORK-BENEFITSENROLLMENT` ➔ `DeselectDependent`

---

## 📁 Files Đã Xuất Vào Dự Án
- **`REAL-pega-classes-catalog.json`**: [REAL-pega-classes-catalog.json](./REAL-pega-classes-catalog.json) (32 Classes)
- **`REAL-pega-properties-catalog.json`**: [REAL-pega-properties-catalog.json](./REAL-pega-properties-catalog.json) (178 Properties)
- **`REAL-pega-rules-catalog-summary.json`**: [REAL-pega-rules-catalog-summary.json](./REAL-pega-rules-catalog-summary.json) (Full Rules Summary)
