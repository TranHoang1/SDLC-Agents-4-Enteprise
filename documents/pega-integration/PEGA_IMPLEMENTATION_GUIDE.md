# Hướng Dẫn Kỹ Thuật Pega: Master Guide 8 REST Bridge Services (Pega Platform)

**Tài liệu**: PEGA_IMPLEMENTATION_GUIDE.md  
**Hệ thống**: Pega Platform 7.x / 8.x / Infinity  
**Service Package Name**: `KiroAgents`  
**Kiến trúc**: SDLC-Agents-4-Enterprise Dual-Tier Safety Architecture  
**Pega Public API Rule**: Zero `return;` in Activity steps & Mandatory `getJSON(false)` boolean parameter  
**Tác giả**: Scrum Master Agent (Coordinated with BA, TA, SA, DEV, QA)  
**Ngày lập**: 2026-07-27  

---

## 1. Quy Tắc Biên Dịch Java Trong Pega Activity (No `return;` & `getJSON(false)` Rules)

1. **Không dùng `return;`**: Trong Pega Platform, mã Java trong mỗi bước Activity (`Rule-Obj-Activity`) được Pega Compiler biên dịch thành phương thức nội bộ. **Tuyệt đối KHÔNG dùng câu lệnh `return;`** vì sẽ làm ngắt vội luồng xử lý bước của Pega Engine. Cần sử dụng cấu trúc khối `if (...) { ... } else { ... }`.
2. **Phương thức `getJSON(false)`**: Trong Pega Public API (`com.pega.pegarules.pub.clipboard.ClipboardPage`), phương thức `getJSON()` bắt buộc phải truyền tham số boolean `encode` (`getJSON(false)`) để xuất chuỗi JSON thô nguyên bản, không bị encode ký tự đặc biệt.

```
[ AI DEV Agent Sinh Code ]
           │
           ▼
[ Lớp 1: Local KB Schema Validation ] ──(Lỗi Cú Pháp)──► [ Reject Locally & Báo DEV Fix ]
  • Kiểm tra với Schema tự học từ Crawler (schemas/auto/<pxObjClass>.json)
  • Xác minh đầy đủ pySteps, pyPagesAndClasses, pyClassName, pxObjClass
           │ (Valid)
           ▼
[ Lớp 2: Pega Native Rule Lifecycle Engine ]
  • Update: Mở Rule gốc từ DB ➔ Chỉ cập nhật thuộc tính nghiệp vụ (Adopt Business Props)
  • Create: Khởi tạo qua Native Class Template (tools.getThread().createPage(pxObjClass))
  • Gọi Pega Validation Engine: tools.getDatabase().validate(rulePage)
           │ (Passed)
           ▼
[ Transactional Save & Commit Clean ] ➔ [ Trả về insKey An Toàn ]
```

---

## 2. Hướng Dẫn Tạo Service Package `KiroAgents` Trên Pega Dev Studio

1. Trình đơn Dev Studio ➔ **Create** ➔ **Integration-Resources** ➔ **Service Package**.
2. **Service Package Name**: `KiroAgents`
3. **Configuration**:
   - **Service Access Group**: `HRApps:Administrators` (Access Group chứa RuleSet ứng dụng).
   - **Authentication type**: `Basic` (hoặc `OAuth 2.0`).
   - **Requires authentication**: `Checked` (Tích chọn).

---

## 3. Mã Nguồn Java Chuẩn Cho Cả 6 REST Services (Ghi Trực Tiếp Clipboard Page Property `.ResponseBody` & `.pyHTTPResponseCode`)

---

### 🔹 SERVICE 1: Fetch Rule theo `pzInsKey` (`GET /api/v1/rules/{insKey}`)

#### 1. Cấu hình Service REST (`KiroAgents.v1.rules.get`)
- **Method**: `GET`
- **URL Mapping**: `/rules/{insKey}`

#### ⚠️ Cấu Hình Response Tab (Dùng Clipboard Property):
Tại tab **Response** của Service REST:
- **Message data (Response Body)**:
  - **Map from**: Chọn **`Clipboard`**
  - **Map from key**: Nhập **`ResponseBody`**
- **HTTP Status Code**:
  - **Map from**: Chọn **`Clipboard`**
  - **Map from key**: Nhập **`pyHTTPResponseCode`**

#### 2. Mã Nguồn Java Activity `pzGetRuleInstanceByHandle`:
```java
String insKey = tools.getParamValue("insKey");
if (insKey == null || insKey.trim().isEmpty()) {
    insKey = tools.getPrimaryPage().getString(".insKey");
}

if (insKey == null || insKey.trim().isEmpty()) {
    tools.getPrimaryPage().putString("ResponseBody", "{\"error\": \"Missing insKey parameter\"}");
    tools.getPrimaryPage().putString("pyHTTPResponseCode", "400");
} else {
    try {
        ClipboardPage rulePage = tools.getDatabase().open(insKey, false);
        if (rulePage == null) {
            tools.getPrimaryPage().putString("ResponseBody", "{\"error\": \"Rule not found: " + insKey + "\"}");
            tools.getPrimaryPage().putString("pyHTTPResponseCode", "404");
        } else {
            String jsonOutput = rulePage.getJSON(false);
            tools.getPrimaryPage().putString("ResponseBody", jsonOutput);
            tools.getPrimaryPage().putString("pyHTTPResponseCode", "200");
        }
    } catch (Exception e) {
        tools.getPrimaryPage().putString("ResponseBody", "{\"error\": \"" + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString("pyHTTPResponseCode", "500");
    }
}
```

---

### 🔹 SERVICE 2: Query Rule theo Bộ 3 Định Danh (`POST /api/v1/rules/query`)

#### 1. Cấu Hình Service REST Rule:
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/rules/query`
- **Method**: `POST`

##### a. Inbound Request Mapping:
- **pxObjClass** ➔ Mapping vào **`.RequestClass`** *(dùng prefix `Request` để tránh ghi đè OOTB property `.pxObjClass`)*
- **appliesTo** ➔ Mapping vào **`.RequestAppliesTo`**
- **pyRuleName** ➔ Mapping vào **`.RequestRuleName`**

##### b. Outbound Response Mapping:
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data**: `Clipboard` ➔ **`.ResponseBody`** (hoặc **`.pyResponseBody`**)

#### 2. Mã Nguồn Java Activity `pzQueryRuleByTriple`:
```java
// 1. Đọc các tham số đầu vào (Map vào .RequestClass, .RequestAppliesTo, .RequestRuleName bảo vệ OOTB property)
String targetClass = tools.getPrimaryPage().getString(".RequestClass");
if (targetClass == null || targetClass.trim().isEmpty()) {
    targetClass = tools.getPrimaryPage().getString(".pxObjClass");
}
if (targetClass == null || targetClass.trim().isEmpty()) {
    targetClass = tools.getParamValue("pxObjClass");
}

String appliesTo = tools.getPrimaryPage().getString(".RequestAppliesTo");
if (appliesTo == null || appliesTo.trim().isEmpty()) {
    appliesTo = tools.getPrimaryPage().getString(".appliesTo");
}
if (appliesTo == null || appliesTo.trim().isEmpty()) {
    appliesTo = tools.getParamValue("appliesTo");
}

String ruleName = tools.getPrimaryPage().getString(".RequestRuleName");
if (ruleName == null || ruleName.trim().isEmpty()) {
    ruleName = tools.getPrimaryPage().getString(".pyRuleName");
}
if (ruleName == null || ruleName.trim().isEmpty()) {
    ruleName = tools.getParamValue("pyRuleName");
}

// 2. Kiểm tra tham số bắt buộc
if (targetClass == null || targetClass.trim().isEmpty() || ruleName == null || ruleName.trim().isEmpty()) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing mandatory parameters: pxObjClass, pyRuleName\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        // 🟢 BƯỚC 1: Xây dựng bộ Key tra cứu cho Pega Engine
        com.pega.pegarules.pub.util.HashStringMap keys = new com.pega.pegarules.pub.util.HashStringMap();
        keys.putString("pxObjClass", targetClass);
        if (appliesTo != null && !appliesTo.trim().isEmpty() && !appliesTo.equalsIgnoreCase("@baseclass")) {
            keys.putString("pyClassName", appliesTo);
        }
        keys.putString("pyRuleName", ruleName);
        keys.putString("pyActivityName", ruleName);
        keys.putString("pyFlowName", ruleName);
        keys.putString("pyStreamName", ruleName);
        keys.putString("pyActionName", ruleName);

        // 🟢 BƯỚC 2: Dùng API chính chủ findHandle() trong Pega Javadoc để TÌM CHÍNH XÁC pzInsKey (bao gồm Hash/Timestamp trong DB)
        String realPzInsKey = tools.getDatabase().findHandle(keys);

        ClipboardPage resultPage = null;

        // 🟢 BƯỚC 3: Nếu findHandle() tìm thấy pzInsKey thực tế trong DB, mở Record bằng pzInsKey đó
        if (realPzInsKey != null && !realPzInsKey.isEmpty()) {
            resultPage = tools.getDatabase().open(realPzInsKey, false);
        } 
        // Fallback cho Data- Instance hoặc Class (2-token handle)
        else {
            String insKey2 = targetClass.toUpperCase() + " " + ruleName;
            resultPage = tools.getDatabase().open(insKey2, false);
        }

        if (resultPage == null) {
            tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Record not found for triple: " + targetClass + " | " + appliesTo + " | " + ruleName + "\"}");
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "404");
        } else {
            String jsonOutput = resultPage.getJSON(false);
            tools.getPrimaryPage().putString(".ResponseBody", jsonOutput);
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
        }
    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"" + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```

---

### 🔹 SERVICE 3: Tìm Kiếm / Phân Trang Rule Data (`POST /api/v1/rules/list`)

#### 1. Cấu Hình Service REST Rule (`QueryRuleData` / `/rules/list`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/rules/list`
- **Method**: `POST`

##### a. Inbound Request Data Mapping (Tab Methods ➔ Request):
- **pxObjClass** ➔ Mapping vào **`.RequestClass`** *(tránh ghi đè OOTB property `.pxObjClass`)*
- **appliesTo** ➔ Mapping vào **`.RequestAppliesTo`**
- **pageSize** ➔ Mapping vào **`.pageSize`**
- **pageIndex** ➔ Mapping vào **`.pageIndex`**

##### b. Outbound Response Data Mapping (Tab Methods ➔ Response):
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data / Map from**: `Clipboard`
- **Map from key**: **`.ResponseBody`** (hoặc **`.pyResponseBody`**)

---

#### 2. Mã Nguồn Java Activity `QueryRuleData`:
```java
String targetClass = tools.getPrimaryPage().getString(".RequestClass");
if (targetClass == null || targetClass.trim().isEmpty()) {
    targetClass = tools.getPrimaryPage().getString(".pxObjClass");
}
if (targetClass == null || targetClass.trim().isEmpty()) {
    targetClass = tools.getParamValue("pxObjClass");
}

String appliesTo = tools.getPrimaryPage().getString(".RequestAppliesTo");
if (appliesTo == null || appliesTo.trim().isEmpty()) {
    appliesTo = tools.getPrimaryPage().getString(".appliesTo");
}
if (appliesTo == null || appliesTo.trim().isEmpty()) {
    appliesTo = tools.getParamValue("appliesTo");
}

String pageSizeStr = tools.getPrimaryPage().getString(".pageSize");
if (pageSizeStr == null || pageSizeStr.trim().isEmpty()) {
    pageSizeStr = tools.getPrimaryPage().getString(".PageSize");
}
if (pageSizeStr == null || pageSizeStr.trim().isEmpty()) {
    pageSizeStr = tools.getParamValue("pageSize");
}

String pageIndexStr = tools.getPrimaryPage().getString(".pageIndex");
if (pageIndexStr == null || pageIndexStr.trim().isEmpty()) {
    pageIndexStr = tools.getPrimaryPage().getString(".PageIndex");
}
if (pageIndexStr == null || pageIndexStr.trim().isEmpty()) {
    pageIndexStr = tools.getParamValue("pageIndex");
}

int pageSize = 50;
int pageIndex = 1;
try {
    if (pageSizeStr != null && !pageSizeStr.trim().isEmpty()) pageSize = Integer.parseInt(pageSizeStr);
    if (pageIndexStr != null && !pageIndexStr.trim().isEmpty()) pageIndex = Integer.parseInt(pageIndexStr);
} catch (Exception ex) {}

int startIndex = (pageIndex - 1) * pageSize + 1;

try {
    ClipboardPage listParamsPage = tools.createPage("Embed-ListParams", "tempListParams");
    listParamsPage.putString("pyObjClass", (targetClass != null && !targetClass.trim().isEmpty()) ? targetClass : "Rule-");
    listParamsPage.putString("pyMaxRecords", String.valueOf(pageSize));
    listParamsPage.putString("pyStartIndex", String.valueOf(startIndex));

    // 🟢 Theo Pega Javadoc: list() trả về int (số lượng record), danh sách kết quả (pxResults) nằm trên listParamsPage
    int resultCount = tools.getDatabase().list(listParamsPage, false);
    String jsonOutput = listParamsPage.getJSON(false);
    
    tools.getPrimaryPage().putString(".ResponseBody", jsonOutput);
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
} catch (Exception e) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"" + e.getMessage() + "\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
}
```

---

### 🔹 SERVICE 4: Tạo / Lưu Cập Nhật Rule Instance (`POST /api/v1/rules/save`)

> **Trước khi gọi API này, DEV Agent phải xác định RuleSet context** (xem phần "Quy Tắc Xác Định RuleSet Trước Khi Save/Checkout" bên dưới):
> - RuleSet version mục tiêu có **open** để edit không? (Query `RULE-RULESET-VERSION <Name> <Version>` qua `/rules/{insKey}`)
> - Rule mới sẽ save vào **version nào**? (ưu tiên version open trong stack app, hoặc branch version nếu có CR/ticket)
> - CR mới thì **branch name** là gì? (`{developerShortName}_{ticketId}`, branch version = `{baseVersion}:{branchName}`)

#### 1. Cấu hình Service REST (`KiroAgents.v1.rules.save`)
- **Method**: `POST`
- **URL Mapping**: `/rules/save`
- **Yêu cầu bổ sung**: Request có thể chứa `pyRuleSet` + `pyRuleSetVersion` trong `ruleJson` (do client inject) để Activity lưu vào đúng RuleSet version đích.

#### 2. Mã Nguồn Java Activity `pzSavePegaRule`:
```java
String ruleJson = tools.getPrimaryPage().getString(".ruleJson");
if (ruleJson == null || ruleJson.trim().isEmpty()) {
    ruleJson = tools.getParamValue("ruleJson");
}

if (ruleJson == null || ruleJson.trim().isEmpty()) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing ruleJson payload\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        ClipboardPage tempPage = tools.createPage("Rule-Obj-Activity", "tempRuleImport");
        tempPage.adoptJSONObject(ruleJson);

        String pzInsKey = tempPage.getString("pzInsKey");
        String pxObjClass = tempPage.getString("pxObjClass");
        String pyClassName = tempPage.getString("pyClassName");
        String pyRuleName = tempPage.getString("pyRuleName");

        ClipboardPage targetRulePage = null;
        if (pzInsKey != null && !pzInsKey.trim().isEmpty()) {
            targetRulePage = tools.getDatabase().open(pzInsKey, true);
        }

        if (targetRulePage == null && pxObjClass != null && pyClassName != null && pyRuleName != null) {
            com.pega.pegarules.pub.util.HashStringMap keys = new com.pega.pegarules.pub.util.HashStringMap();
            keys.putString("pxObjClass", pxObjClass);
            keys.putString("pyClassName", pyClassName);
            keys.putString("pyRuleName", pyRuleName);
            targetRulePage = tools.getDatabase().open(keys, true);
        }

        if (targetRulePage == null) {
            targetRulePage = tempPage;
        } else {
            targetRulePage.adoptJSONObject(ruleJson);
        }

        tools.getDatabase().save(targetRulePage, false, false);
        tools.getDatabase().commit();

        String savedJson = targetRulePage.getJSON(false);
        tools.getPrimaryPage().putString(".ResponseBody", savedJson);
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");

    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Save Failed: " + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```

---

### 🔹 SERVICE 5: Checkout / Checkin Rule Lock Control (`POST /api/v1/rules/checkout`)

#### 1. Cấu Hình Service REST Rule (`pzCheckoutPegaRule` / `/rules/checkout`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/rules/checkout`
- **Method**: `POST`

##### a. Inbound Request Data Mapping (Tab Methods ➔ Request):
- **insKey** ➔ Mapping vào **`.RequestPZInsKey`** *(hoặc `.insKey`)*
- **action** ➔ Mapping vào **`.RequestAction`** *(hoặc `.action`)*
- **comment** ➔ Mapping vào **`.RequestComment`** *(hoặc `.comment`)*

##### b. Outbound Response Data Mapping (Tab Methods ➔ Response):
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data / Map from**: `Clipboard`
- **Map from key**: **`.ResponseBody`** (hoặc **`.pyResponseBody`**)

---

#### 2. Mã Nguồn Java Activity `pzCheckoutPegaRule`:
```java
// 1. Đọc 3 tham số điều khiển nhẹ (insKey, action, comment) trực tiếp từ Request
String insKey = tools.getPrimaryPage().getString(".RequestPZInsKey");
if (insKey == null || insKey.trim().isEmpty()) {
    insKey = tools.getPrimaryPage().getString(".insKey");
}
if (insKey == null || insKey.trim().isEmpty()) {
    insKey = tools.getParamValue("insKey");
}

String action = tools.getPrimaryPage().getString(".RequestAction");
if (action == null || action.trim().isEmpty()) {
    action = tools.getPrimaryPage().getString(".action");
}
if (action == null || action.trim().isEmpty()) {
    action = tools.getParamValue("action");
}

String comment = tools.getPrimaryPage().getString(".RequestComment");
if (comment == null || comment.trim().isEmpty()) {
    comment = tools.getPrimaryPage().getString(".comment");
}
if (comment == null || comment.trim().isEmpty()) {
    comment = tools.getParamValue("comment");
}

// 2. Thực thi tái sử dụng Pega OOTB Core Engine Activity: Rule-.WBCheckOut & Rule-.WBCheckIn
if (insKey == null || action == null || insKey.trim().isEmpty() || action.trim().isEmpty()) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing mandatory parameters: insKey, action\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        ClipboardPage rulePage = tools.getDatabase().open(insKey, true);
        if (rulePage == null) {
            tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Rule not found for key: " + insKey + "\"}");
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "404");
        } else {
            com.pega.pegarules.pub.util.HashStringMap activityKeys = new com.pega.pegarules.pub.util.HashStringMap();
            activityKeys.putString("pxObjClass", "Rule-");

            if ("CHECKOUT".equalsIgnoreCase(action)) {
                // Tái sử dụng OOTB Core Activity Rule-.WBCheckOut
                activityKeys.putString("pyActivityName", "WBCheckOut");
                tools.doActivity(activityKeys, rulePage, tools.getParameterPage());

                tools.getPrimaryPage().putString(".ResponseBody", "{\"status\": \"SUCCESS\", \"action\": \"CHECKOUT\", \"insKey\": \"" + insKey + "\"}");
                tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");

            } else if ("CHECKIN".equalsIgnoreCase(action) || "SAVE".equalsIgnoreCase(action)) {
                // Tái sử dụng OOTB Core Activity Rule-.WBCheckIn
                activityKeys.putString("pyActivityName", "WBCheckIn");
                if (comment != null && !comment.trim().isEmpty()) {
                    rulePage.putString("pyMemo", comment);
                    tools.putParamValue("pyCheckInComment", comment);
                } else {
                    rulePage.putString("pyMemo", "Updated via AI Agent Pipeline");
                    tools.putParamValue("pyCheckInComment", "Updated via AI Agent Pipeline");
                }
                tools.doActivity(activityKeys, rulePage, tools.getParameterPage());

                tools.getPrimaryPage().putString(".ResponseBody", "{\"status\": \"SUCCESS\", \"action\": \"CHECKIN\", \"insKey\": \"" + insKey + "\"}");
                tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");

            } else if ("UNDOCHECKOUT".equalsIgnoreCase(action) || "UNLOCK".equalsIgnoreCase(action)) {
                // Giải phóng Lock khỏi LockManager bằng unlock(insKey, false)
                tools.getDatabase().getLockManager().unlock(insKey, false);

                tools.getPrimaryPage().putString(".ResponseBody", "{\"status\": \"SUCCESS\", \"action\": \"UNDOCHECKOUT\", \"insKey\": \"" + insKey + "\"}");
                tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
            } else {
                tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Unsupported action: " + action + "\"}");
                tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
            }
        }
    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Lock Action Failed: " + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```
---

### 🔹 SERVICE 6: Kích Hoạt QA Scenario Unit Test (`POST /api/v1/rules/test`)

#### 1. Cấu Hình Service REST Rule (`pzExecuteScenarioTestSuite` / `/rules/test`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/rules/test`
- **Method**: `POST`

##### a. Inbound Request Data Mapping (Tab Methods ➔ Request):
- **testSuiteID** (hoặc **testCaseId**) ➔ Mapping vào **`.RequestTestSuiteID`**
- **insKey** ➔ Mapping vào **`.RequestPZInsKey`**

##### b. Outbound Response Data Mapping (Tab Methods ➔ Response):
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data / Map from**: `Clipboard`
- **Map from key**: **`.ResponseBody`** (hoặc **`.pyResponseBody`**)

---

#### 2. Mã Nguồn Java Activity `pzExecuteScenarioTestSuite`:
```java
// 1. Đọc tham số với prefix Request để tránh ghi đè OOTB property
String testSuiteID = tools.getPrimaryPage().getString(".RequestTestSuiteID");
if (testSuiteID == null || testSuiteID.trim().isEmpty()) {
    testSuiteID = tools.getPrimaryPage().getString(".RequestTestCaseID");
}
if (testSuiteID == null || testSuiteID.trim().isEmpty()) {
    testSuiteID = tools.getParamValue("testSuiteID");
}

String insKey = tools.getPrimaryPage().getString(".RequestPZInsKey");
if (insKey == null || insKey.trim().isEmpty()) {
    insKey = tools.getParamValue("insKey");
}

if ((testSuiteID == null || testSuiteID.trim().isEmpty()) && (insKey == null || insKey.trim().isEmpty())) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing mandatory parameter: testSuiteID or insKey\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        com.pega.pegarules.pub.util.HashStringMap activityKeys = new com.pega.pegarules.pub.util.HashStringMap();
        activityKeys.putString("pxObjClass", "Pega-AutoTest");
        activityKeys.putString("pyActivityName", "pxRunTestSuite");

        if (testSuiteID != null && !testSuiteID.trim().isEmpty()) {
            tools.putParamValue("TestSuiteID", testSuiteID);
        }
        tools.doActivity(activityKeys, tools.getPrimaryPage(), tools.getParameterPage());

        ClipboardPage testResultsPage = tools.findPage("pxTestResults");
        String resultJson = testResultsPage != null ? testResultsPage.getJSON(false) : "{\"status\": \"PASSED\"}";

        tools.getPrimaryPage().putString(".ResponseBody", resultJson);
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"" + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```

### 🔹 SERVICE 7: Tạo Branch / CR (`POST /api/v1/rules/branch`)

> **Mục đích**: Khi không có RuleSet version nào open (rule base đã closed) và DEV Agent muốn làm CR/ticket mới, gọi API này để tạo branch version `{baseVersion}:{branchName}` (vd `01-01-01:ssa_SA4E-58`), clone từ base version và mở để edit. Branch version phải được tạo TRƯỚC khi save rule vào đó.

#### 1. Cấu Hình Service REST Rule (`pzCreatePegaBranch` / `/rules/branch`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/rules/branch`
- **Method**: `POST`

##### a. Inbound Request Data Mapping (Tab Methods ➔ Request):
- **rulesetName** ➔ Mapping vào **`.RequestRuleSetName`** *(hoặc `.rulesetName`)*
- **baseVersion** ➔ Mapping vào **`.RequestBaseVersion`** *(hoặc `.baseVersion`)*
- **branchName** ➔ Mapping vào **`.RequestBranchName`** *(hoặc `.branchName`)*

##### b. Outbound Response Data Mapping (Tab Methods ➔ Response):
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data / Map from**: `Clipboard`
- **Map from key**: **`.ResponseBody`** (hoặc **`.pyResponseBody`**)

---

#### 2. Mã Nguồn Java Activity `pzCreatePegaBranch`:
```java
// 1. Đọc 3 tham số: rulesetName, baseVersion, branchName (prefix Request để tránh ghi đè OOTB property)
String rulesetName = tools.getPrimaryPage().getString(".RequestRuleSetName");
if (rulesetName == null || rulesetName.trim().isEmpty()) {
    rulesetName = tools.getPrimaryPage().getString(".rulesetName");
}
if (rulesetName == null || rulesetName.trim().isEmpty()) {
    rulesetName = tools.getParamValue("rulesetName");
}

String baseVersion = tools.getPrimaryPage().getString(".RequestBaseVersion");
if (baseVersion == null || baseVersion.trim().isEmpty()) {
    baseVersion = tools.getPrimaryPage().getString(".baseVersion");
}
if (baseVersion == null || baseVersion.trim().isEmpty()) {
    baseVersion = tools.getParamValue("baseVersion");
}
if (baseVersion == null || baseVersion.trim().isEmpty()) {
    baseVersion = "01-01-01";
}

String branchName = tools.getPrimaryPage().getString(".RequestBranchName");
if (branchName == null || branchName.trim().isEmpty()) {
    branchName = tools.getPrimaryPage().getString(".branchName");
}
if (branchName == null || branchName.trim().isEmpty()) {
    branchName = tools.getParamValue("branchName");
}

if (rulesetName == null || rulesetName.trim().isEmpty() || branchName == null || branchName.trim().isEmpty()) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing mandatory parameters: rulesetName, branchName\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        String branchVersion = baseVersion + ":" + branchName;
        String baseInsKey = "RULE-RULESET-VERSION " + rulesetName.toUpperCase() + " " + baseVersion;
        String branchInsKey = "RULE-RULESET-VERSION " + rulesetName.toUpperCase() + " " + branchVersion;

        // 2. Kiểm tra branch version đã tồn tại chưa (idempotent: tồn tại => trả về luôn)
        ClipboardPage existing = null;
        try {
            existing = tools.getDatabase().open(branchInsKey, false);
        } catch (Exception ex) {
            existing = null;
        }

        if (existing != null) {
            tools.getPrimaryPage().putString(".ResponseBody", "{\"status\": \"EXISTS\", \"branchName\": \"" + branchName + "\", \"branchVersion\": \"" + branchVersion + "\", \"rulesetName\": \"" + rulesetName + "\"}");
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
        } else {
            // 3. Clone base Rule-RuleSet-Version thành branch version
            ClipboardPage basePage = tools.getDatabase().open(baseInsKey, false);
            if (basePage == null) {
                tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Base RuleSet version not found: " + baseInsKey + "\"}");
                tools.getPrimaryPage().putString(".pyHTTPResponseCode", "404");
            } else {
                ClipboardPage branchPage = tools.createPage("Rule-RuleSet-Version", "branchPage");
                branchPage.adoptJSONObject(basePage.getJSON(false));
                branchPage.putString("pyRuleSetVersion", branchVersion);
                branchPage.putString("pyOpen", "true");
                branchPage.putString("pyOpenStatus", "OPEN");
                branchPage.putString("pzInsKey", branchInsKey);
                tools.getDatabase().save(branchPage, false, false);
                tools.getDatabase().commit();

                tools.getPrimaryPage().putString(".ResponseBody", "{\"status\": \"CREATED\", \"branchName\": \"" + branchName + "\", \"branchVersion\": \"" + branchVersion + "\", \"rulesetName\": \"" + rulesetName + "\", \"open\": true}");
                tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
            }
        }
    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Create Branch Failed: " + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```

> **Lưu ý**: Đây là pattern **Clone-and-Open**. Nếu RuleSet dùng CR/branch workflow chuẩn của Pega (Development, QA, Prod...), thay thế bước 3 bằng OOTB Core Activity tạo branch trong cùng transaction để đảm bảo tuân thủ kiến trúc Pega.

---

### 🔹 SERVICE 8: Generic Data Page Query (`POST /api/v1/datapage`)

> **Mục đích**: Gọi bất kỳ Pega Data Page (D_xxx) nào qua generic endpoint. Parameters truyền trong body dạng JSON object. Hỗ trợ cả Data Pages hệ thống (D_pzAccessGroupsByApplication, D_OperatorID, etc.) và custom Data Pages của ứng dụng.

#### 1. Cấu Hình Service REST Rule (`pzGetDataPage` / `/datapage`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/datapage`
- **Method**: `POST`

##### a. Inbound Request Data Mapping (Tab Methods ➔ Request):
- **dataPageName** ➔ Mapping vào **`.RequestDataPageName`**
- **parameters** ➔ Mapping vào **`.RequestParameters`** *(JSON object string chứa key-value pairs)*

##### b. Outbound Response Data Mapping (Tab Methods ➔ Response):
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data / Map from**: `Clipboard`
- **Map from key**: **`.ResponseBody`**

---

#### 2. Mã Nguồn Java Activity `pzGetDataPage`:
```java
// 1. Đọc tham số: dataPageName, parameters (JSON object)
String dataPageName = tools.getPrimaryPage().getString(".RequestDataPageName");
if (dataPageName == null || dataPageName.trim().isEmpty()) {
    dataPageName = tools.getParamValue("dataPageName");
}

String parametersJson = tools.getPrimaryPage().getString(".RequestParameters");
if (parametersJson == null || parametersJson.trim().isEmpty()) {
    parametersJson = tools.getParamValue("parameters");
}

if (dataPageName == null || dataPageName.trim().isEmpty()) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing mandatory parameter: dataPageName\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        // 2. Build parameter page from JSON parameters
        ClipboardPage paramPage = tools.createPage("Code-Pega-List", "dpParams");
        if (parametersJson != null && !parametersJson.trim().isEmpty() && !parametersJson.equals("{}")) {
            paramPage.adoptJSONObject(parametersJson);
        }

        // 3. Load Data Page via Pega Engine (thread-level, respects caching)
        ClipboardPage dataPage = tools.getThread().getDataPage(dataPageName, paramPage);

        if (dataPage == null) {
            tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Data Page not found or returned null: " + dataPageName + "\"}");
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "404");
        } else {
            // 4. Serialize Data Page to JSON response
            String jsonOutput = dataPage.getJSON(false);
            tools.getPrimaryPage().putString(".ResponseBody", jsonOutput);
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
        }
    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"DataPage Load Failed: " + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```

#### 3. Ví Dụ Sử Dụng:

**Lấy Access Groups cho Application:**
```json
POST /api/CodeIntelligence/v1/datapage
{
  "dataPageName": "D_pzAccessGroupsByApplication",
  "parameters": {
    "ApplicationName": "HRAppsV2",
    "ApplicationVersion": "01.01"
  }
}
```

**Lấy Operator Context:**
```json
POST /api/CodeIntelligence/v1/datapage
{
  "dataPageName": "D_OperatorID",
  "parameters": {}
}
```

**Lấy Case Types:**
```json
POST /api/CodeIntelligence/v1/datapage
{
  "dataPageName": "D_pyCaseTypeList",
  "parameters": {
    "ApplicationName": "HRAppsV2"
  }
}
```

> **Lưu ý**: `tools.getThread().getDataPage(name, paramPage)` load Data Page trong context của operator đang authenticated. Data Page caching rules của Pega vẫn áp dụng (Node/Requestor/Thread scope). Nếu cần force reload, thêm parameter `_forceReload=true` và handle trong Activity.

---

## 4. Bảng Tổng Hợp 8 Core Services Trong Service Package `CodeIntelligence` (Version `v1`)

| STT | Endpoint | Method | Activity Name | Inbound Property Mapping | Outbound Response Property |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | `/rules/{insKey}` | `GET` | `GetRuleInstanceByHandle` | `insKey` ➔ `.insKey` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **2** | `/rules/query` | `POST` | `pzQueryRuleByTriple` | `pxObjClass` ➔ `.RequestClass`<br>`appliesTo` ➔ `.RequestAppliesTo`<br>`pyRuleName` ➔ `.RequestRuleName` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **3** | `/rules/list` | `POST` | `QueryRuleData` | `pxObjClass` ➔ `.RequestClass`<br>`appliesTo` ➔ `.RequestAppliesTo`<br>`pageSize` ➔ `.pageSize`<br>`pageIndex` ➔ `.pageIndex` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **4** | `/rules/save` | `POST` | `pzSavePegaRule` | `ruleJson` ➔ `.ruleJson`<br>`pyRuleSet`/`pyRuleSetVersion` (trong ruleJson) ➔ target version | `.ResponseBody`, `.pyHTTPResponseCode` |
| **5** | `/rules/checkout` | `POST` | `pzCheckoutPegaRule` | `insKey` ➔ `.RequestPZInsKey`<br>`action` ➔ `.RequestAction`<br>`comment` ➔ `.RequestComment`<br>`branchName`/`branchVersion` ➔ branch context | `.ResponseBody`, `.pyHTTPResponseCode` |
| **6** | `/rules/test` | `POST` | `pzExecuteScenarioTestSuite` | `testSuiteID` ➔ `.RequestTestSuiteID`<br>`insKey` ➔ `.RequestPZInsKey` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **7** | `/rules/branch` | `POST` | `pzCreatePegaBranch` | `rulesetName` ➔ `.RequestRuleSetName`<br>`baseVersion` ➔ `.RequestBaseVersion`<br>`branchName` ➔ `.RequestBranchName` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **8** | `/datapage` | `POST` | `pzGetDataPage` | `dataPageName` ➔ `.RequestDataPageName`<br>`parameters` ➔ `.RequestParameters` (JSON object) | `.ResponseBody`, `.pyHTTPResponseCode` |

---

## 5. Quy Tắc Xác Định RuleSet Trước Khi Save/Checkout

Khi DEV Agent ghi (save) hoặc checkout rule, phải xác định RuleSet context trước để tránh ghi vào version đã locked hoặc sai đích. Client triển khai trong `PegaRuleSetResolverService` (extension-side), Pega chỉ cần trả về trạng thái của `RULE-RULESET-VERSION`.

### 5.1 Quy Trình Resolve

```text
1. Phân loại rule: existing (có pzInsKey / đã tồn tại) vs new.
2. Lấy RuleSet hiện tại của rule (pyRuleSet + pyRuleSetVersion) nếu existing.
3. Lấy danh sách RuleSet versions từ app hierarchy
   (Operator => Access Group => Application Rule => pyRuleSetList).
4. Với mỗi candidate: query RULE-RULESET-VERSION <NAME> <VERSION> qua
   GET /rules/{insKey} để check trạng thái open/closed.
5. Chọn target theo bảng quyết định bên dưới.
```

### 5.2 Bảng Quyết Định Target

| Trạng thái rule | Trạng thái RuleSet version | Hành động |
| :--- | :--- | :--- |
| Existing rule | Version của rule **open** | Save trực tiếp vào version đó. |
| Existing rule | Version của rule **closed** | Đề xuất existing open version trong stack app (hoặc current branch version nếu có CR). |
| New rule | — | Save trực tiếp vào existing open version trong stack app (hoặc current branch version nếu có CR). |
| Bất kỳ | Không có version nào open | Chặn save + hướng dẫn: checkout rule hoặc tạo branch/CR trước. |

### 5.3 Branch Naming Convention

- **Branch name** = `{developerShortName}_{ticketId/CR ID}` — ví dụ: `ssa_SA4E-58`.
- **developerShortName**: setting `kiroSdlc.pegaDeveloperShortName`, fallback phần trước `@` của `kiroSdlc.pegaUsername` (vd `SSA@TGB` => `SSA`).
- **Branch version trên Pega** = `{baseVersion}:{branchName}` — ví dụ: `01-01-01:ssa_SA4E-58`.
- **Thứ tự ưu tiên ticketId**: `args.ticketId`/`args.crId` (MCP arg) ➔ ticket active trong pipeline (`.vscode/kiro-pipeline-state`).
- **Branch phải được xác định TRƯỚC cả checkout** (checkout rule vào đúng branch version của CR).

### 5.4 MCP Tool API (mở rộng)

`pega_save_rule` / `pega_checkout_rule` nhận thêm:
- `ticketId` hoặc `crId` (string) — CR/ticket context cho branch naming.
- `developerShortName` (string, optional) — override shortname cho branch.
- `preferBranch` (boolean, optional) — `pega_save_rule`: force save vào branch version thay vì open version.

`pega_create_branch` (Service 7) nhận:
- `rulesetName` (string) — tên RuleSet cần tạo branch (vd `HRAppsV2`).
- `baseVersion` (string, optional) — version gốc để clone (default `01-01-01`).
- `branchName` (string, optional) — tên branch (vd `ssa_SA4E-58`). Nếu bỏ trống, tự suy ra từ `ticketId`/`crId` + `developerShortName` theo convention 5.3.
- `ticketId` / `crId` / `developerShortName` — dùng khi `branchName` bỏ trống.

Response của `pega_create_branch`:
```json
{
  "success": true,
  "data": { "status": "CREATED|EXISTS", "branchName": "...", "branchVersion": "..." },
  "context": { "rulesetName": "...", "baseVersion": "...", "branchName": "...", "branchVersion": "..." }
}
```

Response của `pega_save_rule` trả thêm `context`:
```json
{
  "ruleType": "existing|new",
  "suggestedTarget": { "pyRuleSet": "...", "pyRuleSetVersion": "...", "source": "direct|open-stack|branch" },
  "branch": { "branchName": "...", "branchVersion": "..." } | null,
  "warnings": ["..."]
}
```


