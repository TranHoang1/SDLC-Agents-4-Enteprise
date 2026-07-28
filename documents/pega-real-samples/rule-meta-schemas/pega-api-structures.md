# Cấu Trúc JSON Mẫu Của Các Loại Pega Rule & Data

Tài liệu này cung cấp các mẫu JSON thực tế trả về từ Pega REST API cho từng loại Pega Rule và Data khác nhau, làm tài liệu tham khảo cho quá trình tích hợp và kiểm thử.

---

## 1. Activity (`Rule-Obj-Activity`)
Activity định nghĩa các bước thực thi tuần tự (steps) và các phương thức gọi (`Call`, `Branch`).

```json
{
  "pxObjClass": "Rule-Obj-Activity",
  "pyClassName": "Work-Cover-Jira",
  "pyActivityName": "ResolveTicket",
  "pyRuleset": "JiraIntegration",
  "pyRulesetVersion": "01-02-03",
  "pyLabel": "Process and Resolve Jira Ticket",
  "steps": [
    {
      "pyStepNum": "1",
      "pyMethod": "Call",
      "pyMethodParameters": "Work-Cover-Jira.ValidateData",
      "pyLabel": "Validate Input Data"
    },
    {
      "pyStepNum": "2",
      "pyMethod": "Call",
      "pyMethodParameters": "@baseclass.SendNotification",
      "pyLabel": "Send Email Notification"
    }
  ]
}
```

---

## 2. Data Transform (`Rule-Obj-Model`)
Data Transform chứa danh sách các hành vi ánh xạ dữ liệu (`pyActions`) như `Set`, `Apply Data Transform`, `Append and Map to`.

```json
{
  "pxObjClass": "Rule-Obj-Model",
  "pyClassName": "Work-Cover-Jira",
  "pyModelName": "InitializeTicketData",
  "pyRuleset": "JiraIntegration",
  "pyRulesetVersion": "01-02-03",
  "pyActions": [
    {
      "pyActionType": "Apply Data Transform",
      "pyTarget": "SetDefaultStatus"
    }
  ]
}
```

---

## 3. Decision Table (`Rule-Declare-DecisionTable`)
Decision Table quy định bảng quyết định các điều kiện và giá trị trả về tương ứng.

```json
{
  "pxObjClass": "Rule-Declare-DecisionTable",
  "pyClassName": "Work-Cover-Jira",
  "pyLabel": "DeterminePriorityTable",
  "pyRuleset": "JiraIntegration",
  "pyRulesetVersion": "01-02-03",
  "pyPropertyEvaluated": "pyPriority",
  "pyReturnActions": [
    { "pyTransformName": "SetHighPriorityData" }
  ]
}
```

---

## 4. Data Instance (`Data-Admin-Operator-ID`)
Data Instance chứa thông tin tài khoản người dùng, không phân chia theo Ruleset hay Version.

```json
{
  "pxObjClass": "Data-Admin-Operator-ID",
  "pyUserIdentifier": "lead.dev@company.com",
  "pyUserName": "Lead Developer",
  "pyAccessGroup": "JiraIntegration:Authors",
  "pyUpdateDateTime": "2026-07-25T10:00:00.000Z"
}
```
