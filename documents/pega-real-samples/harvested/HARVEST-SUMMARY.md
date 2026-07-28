# Pega Real Data Harvest — Full Workflow Traverse Report
**Server**: https://9ucseukj.pegaacademy.net/prweb  
**Operator**: SSA@TGB (Access Group: `HRAppsV2:Administrators`)  
**Application**: HRAppsV2 (01.01) — TGB Organization  
**Date**: 2026-07-26  

---

## 🔥 ĐỘT PHÁ: Đã Traverse Thành Công Toàn Bộ Life-Cycle Workflow Thật

Bằng cách sử dụng REST API endpoint chính xác: `POST /api/v1/assignments/{id}?actionID={actionID}`, chúng ta đã chạy qua từng bước (Step-by-Step) và thu thập **toàn bộ state JSON thật** từ khởi tạo đến **Resolved-Completed** cho các Case Types!

---

## 📊 Summary Dữ Liệu Thu Được Từ Workflow Traversal

### 1. Case: EmployeeEvaluation (`TGB-HRAPPS-WORK EE-2`)
- **Status cuối**: `Resolved-Completed`
- **Các bước đã traverse & harvest data**:
  - `Step 1`: Assignment `Identify employee` (Action `IdentifyEmployee_0`)
  - `Step 2`: Assignment `Identify assessment period` (Action `IdentifyAssessmentPeriod_0`)
  - `Step 3`: Assignment `Review assessment` (Action `ReviewAssessment_0`)
  - `Step 4`: Final state `Resolved-Completed` ([REAL-step-final-EmployeeEvaluation.json](./REAL-step-final-EmployeeEvaluation.json))

### 2. Case: PayrollSetup (`TGB-HRAPPS-WORK P-2`)
- **Status cuối**: `Resolved-Completed`
- **Các bước đã traverse & harvest data**:
  - `Step 1`: Assignment `Collect employee information` (Stage `PRIM0`)
  - `Step 2`: Assignment `Select filing status` (Stage `PRIM1`)
  - `Step 3`: Assignment `Calculate exemptions` (Stage `PRIM1`)
  - `Step 4`: Assignment `Provide bank information` (Stage `PRIM2`)
  - `Step 5`: Assignment `Review selections` (Stage `PRIM3`)
  - `Step 6`: Final state `Resolved-Completed` ([REAL-step-final-PayrollSetup.json](./REAL-step-final-PayrollSetup.json))

### 3. Case: BenefitsEnrollment (`TGB-HRAPPS-WORK B-1`)
- **Status cuối**: `Resolved-Completed`
- **Các bước đã traverse & harvest data**:
  - `Step 1`: Assignment `Confirm Employee Details` (Stage `PRIM1`)
  - `Step 2`: Assignment `Identify Dependents` (Stage `PRIM1`)
  - `Step 3`: Assignment `Select Medical Coverage` (Stage `PRIM2`)
  - `Step 4`: Assignment `Select Dental Coverage` (Stage `PRIM2`)
  - `Step 5`: Assignment `Select Vision Coverage` (Stage `PRIM2`)
  - `Step 6`: Assignment `Review Selections` (Stage `PRIM3`)
  - `Step 7`: Final state `Resolved-Completed` ([REAL-step-final-BenefitsEnrollment.json](./REAL-step-final-BenefitsEnrollment.json))

### 4. Case: Candidate (`TGB-HRAPPS-WORK C-2`)
- `Step 1`: Assignment `Collect Educational Details` (Stage `PRIM1`)
- `Step 2`: Assignment `Collect Work Sample` (Stage `PRIM1`)
- `Step 3`: Assignment `Conduct phone screen` (Stage `PRIM2` — dừng lại do cần input form validation)

---

## 🛠️ Danh Sách Ứng Dụng Trong Pega Instance (`api/v1/applications`)

Đã khai thác danh sách tất cả các ứng dụng có trên server:
1. **HRAppsV2** (01.01) — Enterprise HR Application
2. **GoGoRoad** (01.01.01) — Roadside assistance sample
3. **Payroll** (01.01.01) — Dedicated Payroll sub-app
4. **Employee** (01.01.01) — Employee Portal app
5. **Payment** (01.01.01) — Payment processing app
6. **TrackIT** (01.01.01) — Asset tracking app
7. **Shipment** (01.01.01) — Logistics app
8. **FraudInv** (01.01.01) — Fraud Investigation app
9. **PegaRobotManager** (8) — RPA Bot manager app

---

## 💎 Cấu Trúc Rule Thật Rút Ra Từ Workflow Traversal

Từ dữ liệu harvested qua từng bước (`REAL-step-*.json`), chúng ta đã trích xuất được schema chính xác cho các rule core:

1. **`pxFlow` Map Engine Schema**:
   - `pxAssignActivity`: Activity xử lý routing (`WorkList`, `pzCreateInternalAssignment`...)
   - `pxAssignClass`: Assignment class (`Assign-Worklist`, `Assign-Internal`...)
   - `pxFlowInsKey`: Dynamic rule key theo GMT timestamp
   - `pyFlowParameters`: Map chứa context parameters của Stage & Step (`pyCaseTypePurpose`, `flowClass`, `CurrentStage`...)
   - `pyFlowPath`: Array lưu trace history của Flow execution path.

2. **`pxStageHistory` Engine Schema**:
   - `pxStageID`, `pxStageName`, `pxStageType` (`Primary` / `Alternate`)
   - `pxProcesses`: Lưu danh sách process history trong stage.
   - `pxSteps`: Trace từng Step ID (`ASSIGNMENT63`...) và type (`ASSIGNMENT`, `UTILITY`...).

3. **Data Transform & Case State transition**:
   - `pyStatusWork` thay đổi tự động qua từng stage transition (`New` -> `Open` -> `Pending-Approval` -> `Resolved-Completed`).
