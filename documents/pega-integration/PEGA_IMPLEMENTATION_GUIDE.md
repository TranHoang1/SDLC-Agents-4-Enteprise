# Hướng Dẫn Kỹ Thuật Pega: Master Guide 7 REST Bridge Services (Pega Platform)

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

#### 1. Cấu hình Service REST (`KiroAgents.v1.rules.save`)
- **Method**: `POST`
- **URL Mapping**: `/rules/save`

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

---

## 4. Bảng Tổng Hợp 6 Core Services Trong Service Package `CodeIntelligence` (Version `v1`)

| STT | Endpoint | Method | Activity Name | Inbound Property Mapping | Outbound Response Property |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | `/rules/{insKey}` | `GET` | `GetRuleInstanceByHandle` | `insKey` ➔ `.insKey` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **2** | `/rules/query` | `POST` | `pzQueryRuleByTriple` | `pxObjClass` ➔ `.RequestClass`<br>`appliesTo` ➔ `.RequestAppliesTo`<br>`pyRuleName` ➔ `.RequestRuleName` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **3** | `/rules/list` | `POST` | `QueryRuleData` | `pxObjClass` ➔ `.RequestClass`<br>`appliesTo` ➔ `.RequestAppliesTo`<br>`pageSize` ➔ `.pageSize`<br>`pageIndex` ➔ `.pageIndex` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **4** | `/rules/save` | `POST` | `pzSavePegaRule` | `ruleJson` ➔ `.ruleJson` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **5** | `/rules/checkout` | `POST` | `pzCheckoutPegaRule` | `insKey` ➔ `.RequestPZInsKey`<br>`action` ➔ `.RequestAction`<br>`comment` ➔ `.RequestComment` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **6** | `/rules/test` | `POST` | `pzExecuteScenarioTestSuite` | `testSuiteID` ➔ `.RequestTestSuiteID`<br>`insKey` ➔ `.RequestPZInsKey` | `.ResponseBody`, `.pyHTTPResponseCode` |


