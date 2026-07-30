# Pega Service Package Specification — Rule Instance Fetcher API

This document provides the specification for exposing full Pega Rule Instances via a dedicated REST Service Package on Pega Platform.

## Overview
- **Service Package Name**: `KiroRules`
- **Service Class**: `Pega-API-RuleManagement`
- **Authentication**: Basic Authentication / OAuth 2.0 (Bearer Token)
- **Supported Endpoints**:
  1. `GET /api/v1/rules/{insKey}` — Retrieve rule by `pzInsKey`.
  2. `POST /api/v1/rules/query` — Retrieve rule by **Rule Name**, **Rule Type Class (`pxObjClass`)**, and **Applies To Class (`pyClassName`)**.
  3. `GET /api/v1/rules/list` — List rules in Application/RuleSet scope.
  4. `POST /api/v1/rules/save` — Create/Update Pega Rule with native adoption.
  5. `POST /api/v1/rules/checkout` — Rule checkout/checkin lock control.
  6. `POST /api/v1/rules/test` — Execute automated scenario test suite.
  7. `POST /api/v1/rules/metadata` — Extract Class Definition (`pySuperClass`, `pyPatternParent`) and Properties (`Rule-Obj-Property`).

---

## REST Endpoint Specifications

### 1. `POST /api/v1/rules/query` (Query by Rule Name, Type Class, and Applies To Class)

#### Request Body
```json
{
  "pxObjClass": "Rule-Obj-FlowAction",
  "appliesTo": "TGB-HRApps-Work-Candidate",
  "pyRuleName": "CollectCandidateDetails"
}
```

#### Field Descriptions
| Parameter | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `pxObjClass` | `string` | Pega Rule Type Class | `Rule-Obj-FlowAction`, `Rule-HTML-Section`, `Rule-Obj-Flow` |
| `appliesTo` | `string` | Applies To Class (`pyClassName`) | `TGB-HRApps-Work-Candidate` |
| `pyRuleName` | `string` | Name of the Pega Rule | `CollectCandidateDetails` |

#### Response (`200 OK`)
```json
{
  "pxObjClass": "Rule-Obj-FlowAction",
  "pyClassName": "TGB-HRApps-Work-Candidate",
  "pyRuleName": "CollectCandidateDetails",
  "pzInsKey": "RULE-OBJ-FLOWACTION TGB-HRAPPS-WORK-CANDIDATE COLLECTCANDIDATEDETAILS #20250416T200813.010 GMT",
  "pyApplication": "HRAppsV2",
  "pyRuleSet": "HRAppsV2",
  "pyRuleSetVersion": "01-01-01",
  "pyStatus": "Available",
  "pyDescription": "Collect Candidate Details Flow Action",
  "pxCreateDateTime": "2025-04-16T20:08:13.010Z",
  "pySteps": [
    {
      "pxObjClass": "Embed-Step",
      "pyStepName": "CollectDetails",
      "pyStepType": "FlowAction"
    }
  ],
  "pyPagesAndClasses": [
    {
      "pxObjClass": "Embed-PagesAndClasses",
      "pyPageName": "pyWorkPage",
      "pyClassName": "TGB-HRApps-Work-Candidate"
    }
  ]
}
```

---

### 2. `GET /api/v1/rules/{insKey}` (Query by InsKey Handle)

#### Request Path Parameters
| Parameter | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `insKey` | `string` | Pega Rule Instance Key (`pzInsKey`) | `RULE-OBJ-CLASS TGB-HRAPPS-WORK-BENEFITSENROLLMENT` |

---

## Pega Deployment Steps for System Administrators

1. **Create Service Package**:
   - Navigate to **Dev Studio** ➔ **Integration** ➔ **Service Packages**.
   - Create package `KiroRules` with Service Class `Rule-Service-REST`.
   - Set Authentication to `Basic` or `OAuth 2.0`.

2. **Create REST Service Rule (`Rule-Service-REST`)**:
   - Service Name: `queryRule`
   - Method: `POST`
   - URL Pattern: `/rules/query`
   - Service Activity: `pzGetRuleXML` (or custom Activity querying Pega DB using `pxObjClass`, `pyClassName`, and `pyRuleName`).

3. **Verify API Access**:
   - Send `POST https://<pega-host>/prweb/api/v1/rules/query` with JSON body containing `{ "pxObjClass": "Rule-Obj-FlowAction", "appliesTo": "TGB-HRApps-Work-Candidate", "pyRuleName": "CollectCandidateDetails" }`.
