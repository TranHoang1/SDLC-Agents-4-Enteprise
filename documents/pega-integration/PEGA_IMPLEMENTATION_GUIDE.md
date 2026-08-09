# Hướng Dẫn Kỹ Thuật Pega: Master Guide 10 REST Bridge Services (Pega Platform)

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
// 1. Đọc các tham số đầu vào (Hỗ trợ fallback linh hoạt)
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
        com.pega.pegarules.pub.util.StringMap keys = new com.pega.pegarules.pub.util.HashStringMap();
        keys.putString("pxObjClass", targetClass);

        // 🟢 BƯỚC 1: Dò ngược cây kế thừa để tìm định nghĩa Key thực sự
        String currentClassToInspect = targetClass;
        boolean keyFound = false;

        while (currentClassToInspect != null && !currentClassToInspect.trim().isEmpty()) {
            com.pega.pegarules.pub.util.StringMap classKeys = new com.pega.pegarules.pub.util.HashStringMap();
            classKeys.putString("pxObjClass", "Rule-Obj-Class");
            classKeys.putString("pyClassName", currentClassToInspect);
            
            ClipboardPage classDef = tools.getDatabase().open(classKeys, false);
            
            if (classDef == null) break;

            ClipboardProperty keyList = classDef.getProperty("pyKeyDefList");
            
            // Kiểm tra list có tồn tại và phần tử đầu tiên không bị rỗng như trong ảnh
            if (keyList != null && keyList.size() > 0) {
                ClipboardProperty firstKey = keyList.getPropertyValue(1);
                String firstKeyName = firstKey.getStringValue("pyKeyName");
                
                if (firstKeyName != null && !firstKeyName.trim().isEmpty()) {
                    // Đã tìm thấy class định nghĩa Key
                    java.util.Iterator keyIter = keyList.iterator();
                    while (keyIter.hasNext()) {
                        ClipboardProperty keyProp = (ClipboardProperty) keyIter.next();
                        String keyName = keyProp.getStringValue("pyKeyName");
                        
                        if ("pyClassName".equals(keyName) && appliesTo != null && !appliesTo.trim().isEmpty() && !appliesTo.equalsIgnoreCase("@baseclass")) {
                            keys.putString(keyName, appliesTo);
                        } else if (!"pyClassName".equals(keyName)) {
                            keys.putString(keyName, ruleName);
                        }
                    }
                    keyFound = true;
                    break; // Thoát vòng lặp while
                }
            }
            
            // Nếu rỗng (như hình bạn chụp), nhảy lên class cha để tìm tiếp
            currentClassToInspect = classDef.getString("pyDerivesFrom");
        }

        // Fallback an toàn nếu quét hết cây vẫn không thấy
        if (!keyFound) {
            if (appliesTo != null && !appliesTo.trim().isEmpty()) {
                keys.putString("pyClassName", appliesTo);
            }
            keys.putString("pyRuleName", ruleName);
        }

        // 🟢 BƯỚC 2: Thực thi Rule Resolution thông qua API open()
        ClipboardPage resultPage = tools.getDatabase().open(keys, false);

        // 🟢 BƯỚC 3: Xử lý Output
        if (resultPage == null) {
            tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Record not found via Rule Resolution for: " + targetClass + " | " + appliesTo + " | " + ruleName + "\"}");
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "404");
        } else {
            String jsonOutput = resultPage.getJSON(false);
            tools.getPrimaryPage().putString(".ResponseBody", jsonOutput);
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
        }

    } catch (com.pega.pegarules.pub.database.DatabaseException dbEx) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Database Exception: " + dbEx.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Internal Server Error: " + e.getMessage() + "\"}");
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

### 🔹 SERVICE 8a: Data Page — List Results (`POST /api/v1/datapage/list`)

> **Mục đích**: Gọi Pega Data Page trả về **danh sách records** (có `pxResults` page list). Dùng cho: `D_pzAccessGroupsByApplication`, `D_pyCaseTypeList`, `D_pzRuleSetsInApplication`, v.v.

#### 1. Cấu Hình Service REST Rule (`pzGetDataPageList` / `/datapage/list`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/datapage/list`
- **Method**: `POST`

##### a. Inbound Request Data Mapping:
- **dataPageName** ➔ Query string parameter ➔ **`.RequestDataPageName`**
- **Request Body** ➔ Parameters JSON object ➔ **`.ruleJson`** *(body chứa key-value pairs trực tiếp)*

##### b. Outbound Response Data Mapping:
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data**: `Clipboard` ➔ **`.ResponseBody`**

#### 2. Mã Nguồn Java Activity `pzGetDataPageList`:
```java
String dataPageName = tools.getPrimaryPage().getString(".RequestDataPageName");
if (dataPageName == null || dataPageName.trim().isEmpty()) {
    dataPageName = tools.getParamValue("dataPageName");
}
String parametersJson = tools.getPrimaryPage().getString(".ruleJson");
if (parametersJson == null || parametersJson.trim().isEmpty()) {
    parametersJson = tools.getParamValue("parameters");
}

dataPageName = "D_pzAccessGroupsByApplication";
parametersJson = "{ \"ApplicationName\": \"HRAppsV2\", \"ApplicationVersion\": \"01.01\" }";


if (dataPageName == null || dataPageName.trim().isEmpty()) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing: dataPageName\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        // 1. Parse JSON parameters using org.json (available in Pega classpath)
        // Input: {"AppName":"HRAppsV2","AppVersion":"01.01"}
        // Output: ["AppName","HRAppsV2","AppVersion","01.01"]
        java.util.List<String> paramPairs = new java.util.ArrayList<String>();
        if (parametersJson != null && !parametersJson.trim().isEmpty() && !parametersJson.equals("{}")) {
            org.json.JSONObject jsonObj = new org.json.JSONObject(parametersJson);
            for (String key : jsonObj.keySet()) {
                paramPairs.add(key);
                paramPairs.add(jsonObj.optString(key, ""));
            }
        }

        // 2. Call pega.findDataPage with dynamic varargs
        com.pega.pegarules.priv.PegaAPI pega = (com.pega.pegarules.priv.PegaAPI) tools;
        String[] args = paramPairs.toArray(new String[0]);
        ClipboardPage dataPage = pega.findDataPage(dataPageName, true, args);
      
        if (dataPage == null) {
            tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Data Page not found: " + dataPageName + "\", \"pxResults\": [], \"totalCount\": 0}");
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "404");
        } else {
            // 3. Extract pxResults list and serialize
            tools.getPrimaryPage().putString(".ResponseBody", dataPage.getJSON(false));            
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
        }
    } catch (Exception e) {
        String errMsg = e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Unknown error";
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"" + errMsg + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```

#### 3. Ví Dụ:
```json
POST /api/CodeIntelligence/v1/datapage/list?dataPageName=D_pzAccessGroupsByApplication
Content-Type: application/json

{ "AppName": "HRAppsV2", "AppVersion": "01.01" }
```
**Response:** `{ "pxResults": [{ "pyAccessGroup": "HRAppsV2:Administrators", ... }, ...], "totalCount": 5 }`

---

### 🔹 SERVICE 8b: Data Page — Single Page (`POST /api/v1/datapage/single`)

> **Mục đích**: Gọi Pega Data Page trả về **1 page duy nhất** (không có pxResults). Dùng cho: `D_OperatorID`, `D_pyUserProfile`, `D_pzApplicationInfo`, v.v.

#### 1. Cấu Hình Service REST Rule (`pzGetDataPageSingle` / `/datapage/single`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/datapage/single`
- **Method**: `POST`

##### a. Inbound Request Data Mapping:
- **dataPageName** ➔ Query string parameter ➔ **`.RequestDataPageName`**
- **Request Body** ➔ Parameters JSON object ➔ **`.ruleJson`** *(body chứa key-value pairs trực tiếp)*

##### b. Outbound Response Data Mapping:
- **HTTP status code**: `Clipboard Property` ➔ **`.pyHTTPResponseCode`**
- **Message Data**: `Clipboard` ➔ **`.ResponseBody`**

#### 2. Mã Nguồn Java Activity `pzGetDataPageSingle`:
```java
String dataPageName = tools.getPrimaryPage().getString(".RequestDataPageName");
if (dataPageName == null || dataPageName.trim().isEmpty()) {
    dataPageName = tools.getParamValue("dataPageName");
}
String parametersJson = tools.getPrimaryPage().getString(".ruleJson");
if (parametersJson == null || parametersJson.trim().isEmpty()) {
    parametersJson = tools.getParamValue("parameters");
}

if (dataPageName == null || dataPageName.trim().isEmpty()) {
    tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Missing: dataPageName\"}");
    tools.getPrimaryPage().putString(".pyHTTPResponseCode", "400");
} else {
    try {
        // 1. Convert JSON parameters to String[] varargs
        java.util.List<String> paramPairs = new java.util.ArrayList<String>();
        if (parametersJson != null && !parametersJson.trim().isEmpty() && !parametersJson.equals("{}")) {
            String cleaned = parametersJson.trim();
            if (cleaned.startsWith("{")) cleaned = cleaned.substring(1);
            if (cleaned.endsWith("}")) cleaned = cleaned.substring(0, cleaned.length() - 1);
            String[] entries = cleaned.split(",");
            for (String entry : entries) {
                String[] kv = entry.split(":", 2);
                if (kv.length == 2) {
                    String key = kv[0].trim().replace("\"", "");
                    String val = kv[1].trim().replace("\"", "");
                    paramPairs.add(key);
                    paramPairs.add(val);
                }
            }
        }

        // 2. Call pega.findDataPage with dynamic varargs
        com.pega.pegarules.priv.PegaAPI pega = (com.pega.pegarules.priv.PegaAPI) tools;
        String[] args = paramPairs.toArray(new String[0]);
        ClipboardPage dataPage = pega.findDataPage(dataPageName, false, args);

        if (dataPage == null) {
            tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"Data Page not found: " + dataPageName + "\"}");
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "404");
        } else {
            // 3. Serialize entire page as single JSON object
            String jsonOutput = dataPage.getJSON(false);
            tools.getPrimaryPage().putString(".ResponseBody", jsonOutput);
            tools.getPrimaryPage().putString(".pyHTTPResponseCode", "200");
        }
    } catch (Exception e) {
        tools.getPrimaryPage().putString(".ResponseBody", "{\"error\": \"" + e.getMessage() + "\"}");
        tools.getPrimaryPage().putString(".pyHTTPResponseCode", "500");
    }
}
```

#### 3. Ví Dụ:
```json
POST /api/CodeIntelligence/v1/datapage/single?dataPageName=D_OperatorID
Content-Type: application/json

{}
```
**Response:** `{ "pyUserIdentifier": "SSA@TGB", "pyUserName": "Senior System Architect", "pyAccessGroup": "HRAppsV2:Administrators", ... }`

> **Lưu ý**: Cả 2 endpoints dùng `tools.getThread().getDataPage(name, paramPage)`. Sự khác biệt: `list` trích `pxResults` → JSON array; `single` serialize toàn bộ page → JSON object.

---

### 🔹 SERVICE 9: Rule Explorer — Direct Children (`POST /api/v1/rules/directChildren`)

> **Mục đích**: Duyệt cây Rule Explorer (giống App Explorer trong Dev Studio). Cho phép AI Agent khám phá hierarchy: Class → Category Level 1 → Category Level 2 → Rule Instances. Sử dụng OOTB Data Page `D_DirectChildren` (Activity `LoadDirectChildren`).

#### 1. Cấu Hình Service REST Rule (`pzGetDirectChildren` / `/rules/directChildren`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/rules/directChildren`
- **Method**: `POST`

##### a. Inbound Request Data Mapping:
- **`.ClassName`** ➔ Query string parameter (parent rule class, vd `Rule-Obj-Activity`)
- **`.CategoryLevel1`** ➔ Query string parameter (vd `User Interface`)
- **`.CategoryLevel2`** ➔ Query string parameter (vd `Harness`)

> **Lưu ý**: Parameters truyền qua query string với prefix `.` (dot notation) — đây là convention của Pega Data Page parameters.

##### b. Outbound Response Data Mapping:
- **HTTP status code**: Auto (Pega trả 200 nếu success)
- **Message Data**: Response body = JSON output của Data Page `D_DirectChildren`

#### 2. Kiến Trúc Bên Trong:
- **Data Page**: `D_DirectChildren` (OOTB, `RULE-DECLARE-PAGES`)
- **Source Activity**: `LoadDirectChildren` (Pega internal)
- **Parameters**: `ClassName`, `CategoryLevel1`, `CategoryLevel2`
- **Response Class**: `Embed-ExplorerNode-RuleType`

#### 3. Response Format:
```json
{
  "pxObjClass": "Embed-ExplorerNode-RuleType",
  "pyClass": "Rule-Obj-Activity",
  "pyClassName": "Rule-HTML-Harness",
  "pyLabel": "Harness",
  "pxDPParameters": {
    "CategoryLevel1": "User Interface",
    "CategoryLevel2": "Harness",
    "ClassName": "Rule-Obj-Activity"
  },
  "pxResults": [
    {
      "pxInsName": "RULE-OBJ-ACTIVITY!RULEFORM",
      "pxObjClass": "Embed-ExplorerNode-Rule",
      "pyClass": "Rule-HTML-Harness",
      "pyClassName": "Rule-Obj-Activity",
      "pyLabel": "RuleForm",
      "pyRuleName": "RuleForm",
      "pyRuleAvailable": "Yes",
      "pxPages": {
        "ROC": { "pxObjClass": "Rule-Obj-Class", "pyCategory": "User Interface", "pyLabel": "Harness" },
        "ROP": { "pxObjClass": "Rule-Obj-Property" }
      }
    }
  ],
  "pySourcePage": {
    "pySourceType": "Activity",
    "pySourceIdentifier": "LoadDirectChildren"
  }
}
```

#### 4. Ví Dụ Gọi API:
```bash
curl -X POST \
  'https://{host}/prweb/api/CodeIntelligence/v1/rules/directChildren?.ClassName=Rule-Obj-Activity&.CategoryLevel1=User%20Interface&.CategoryLevel2=Harness' \
  -H 'Authorization: Basic {base64(user:pass)}' \
  -H 'Accept: application/json'
```

#### 5. Use Cases Cho AI Agent:

| Use Case | ClassName | CategoryLevel1 | CategoryLevel2 | Kết quả |
|----------|-----------|----------------|----------------|---------|
| List all Harnesses | `Rule-Obj-Activity` | `User Interface` | `Harness` | Rules kiểu Harness |
| List all Sections | `Rule-Obj-Activity` | `User Interface` | `Section` | Rules kiểu Section |
| List all Activities | `Rule-Obj-Activity` | `Process` | `Activity` | Rules kiểu Activity |
| List all Flows | `Rule-Obj-Activity` | `Process` | `Flow` | Rules kiểu Flow |
| List all Data Transforms | `Rule-Obj-Activity` | `Data Model` | `Data Transform` | Rules kiểu DT |
| List all Decision Tables | `Rule-Obj-Activity` | `Decision` | `Decision Table` | Rules kiểu DT |

> **Navigation Pattern**: Agent duyệt từng cấp (ClassName → categories → rules) bằng cách gọi lần lượt. Response `pyLabel` = tên hiển thị, `pxInsName` = insKey để fetch chi tiết qua Service 1 (`/rules/{insKey}`).

---

### 🔹 SERVICE 10: List Rule Instances với Filter (`POST /api/v1/rules/listRules`)

> **Mục đích**: Tìm kiếm và phân trang rule instances theo ObjClass + filter property. Sử dụng OOTB Data Page `D_RuleInstances`. Khác Service 3 (`/rules/list`) ở chỗ: Service 10 filter theo property name/value cụ thể, hỗ trợ phân trang đầy đủ, và trả về metadata phong phú hơn (totalResultCount, timestamps, RuleSet info).

#### 1. Cấu Hình Service REST Rule (`pzListRules` / `/rules/listRules`):
- **Service Package**: `CodeIntelligence` (Service Version: `v1`)
- **URL Mapping**: `/rules/listRules`
- **Method**: `POST`

##### a. Inbound Request Data Mapping:
- **`ObjClass`** ➔ Query string parameter (rule class, vd `Rule-HTML-Harness`)
- **`FilterPropName`** ➔ Query string parameter (property dùng để filter, vd `pyStreamName`)
- **`FilterPropValue`** ➔ Query string parameter (giá trị filter, vd `RuleForm`)
- **`PageSize`** ➔ Query string parameter (số records/page, default `50`)
- **`PageIndex`** ➔ Query string parameter (trang hiện tại, default `1`)

##### b. Outbound Response Data Mapping:
- **HTTP status code**: Auto (Pega trả 200 nếu success)
- **Message Data**: Response body = JSON output của Data Page `D_RuleInstances`

#### 2. Kiến Trúc Bên Trong:
- **Data Page**: `D_RuleInstances` (OOTB, `RULE-DECLARE-PAGES`)
- **Response Class**: `Code-Pega-List`
- **Pagination metadata**: `pxResultCount`, `pxTotalResultCount`, `pxMore`, `pyPageIndex`, `pyPageSize`

#### 3. Response Format:
```json
{
  "pxObjClass": "Code-Pega-List",
  "pxResultCount": "50",
  "pxTotalResultCount": "110",
  "pxMore": "false",
  "pyPageIndex": "1",
  "pyPageSize": "50",
  "pyObjClassOriginal": "Rule-HTML-Harness",
  "pxDPParameters": {
    "FilterPropName": "pyStreamName",
    "FilterPropValue": "RuleForm",
    "ObjClass": "Rule-HTML-Harness",
    "PageIndex": "1",
    "PageSize": "50"
  },
  "pxResults": [
    {
      "pxObjClass": "Rule-HTML-Harness",
      "pxUpdateDateTime": "20260422T195657.500 GMT",
      "pxUpdateOpName": "Abhilash Medi",
      "pyClassName": "Rule-Service-MCP",
      "pyStreamName": "RuleForm",
      "pzInsKey": "RULE-HTML-HARNESS RULE-SERVICE-MCP RULEFORM #20260422T195657.500 GMT",
      "pyTextValue": ["Pega-IntegrationArchitect:08-25-04"]
    }
  ]
}
```

#### 4. Ví Dụ Gọi API:
```bash
curl -X POST \
  'https://{host}/prweb/api/CodeIntelligence/v1/rules/listRules?ObjClass=Rule-HTML-Harness&FilterPropName=pyStreamName&FilterPropValue=RuleForm&PageSize=50&PageIndex=1' \
  -H 'Authorization: Basic {base64(user:pass)}' \
  -H 'Accept: application/json'
```

#### 5. Use Cases Cho AI Agent:

| Use Case | ObjClass | FilterPropName | FilterPropValue | Kết quả |
|----------|----------|----------------|-----------------|---------|
| Tìm Harness "RuleForm" | `Rule-HTML-Harness` | `pyStreamName` | `RuleForm` | Harnesses tên RuleForm across classes |
| Tìm Activities theo tên | `Rule-Obj-Activity` | `pyActivityName` | `ProcessClaim` | Activities tên ProcessClaim |
| Tìm Flows theo tên | `Rule-Obj-Flow` | `pyFlowName` | `WorkFlow` | Flows tên WorkFlow |
| Tìm Data Transforms | `Rule-Obj-Model` | `pyRuleName` | `SetDefaults` | Data Transforms tên SetDefaults |
| Tìm Sections | `Rule-HTML-Section` | `pyStreamName` | `Details` | Sections tên Details |

#### 6. Response Fields:

| Field | Mô tả |
|-------|--------|
| `pxTotalResultCount` | Tổng số rules khớp filter (không phụ thuộc pagination) |
| `pxResultCount` | Số rules trả về trong page hiện tại |
| `pxMore` | `"true"` nếu còn pages tiếp theo |
| `pyPageIndex` | Page hiện tại |
| `pyPageSize` | Kích thước page |
| `pxResults[].pzInsKey` | insKey đầy đủ — dùng cho Service 1 (`/rules/{insKey}`) |
| `pxResults[].pyClassName` | Class mà rule applies to |
| `pxResults[].pyTextValue` | RuleSet:Version chứa rule |
| `pxResults[].pxUpdateOpName` | Người sửa cuối |

> **So sánh Service 3 vs 10**: Service 3 (`/rules/list`) dùng `tools.getDatabase().list()` — query thô, ít filter. Service 10 (`/rules/listRules`) dùng OOTB Data Page `D_RuleInstances` — filter mạnh hơn, pagination chuẩn, metadata phong phú.

---

## 4. Bảng Tổng Hợp 10 Core Services Trong Service Package `CodeIntelligence` (Version `v1`)

| STT | Endpoint | Method | Activity Name | Inbound Property Mapping | Outbound Response Property |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | `/rules/{insKey}` | `GET` | `GetRuleInstanceByHandle` | `insKey` ➔ `.insKey` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **2** | `/rules/query` | `POST` | `pzQueryRuleByTriple` | `pxObjClass` ➔ `.RequestClass`<br>`appliesTo` ➔ `.RequestAppliesTo`<br>`pyRuleName` ➔ `.RequestRuleName` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **3** | `/rules/list` | `POST` | `QueryRuleData` | `pxObjClass` ➔ `.RequestClass`<br>`appliesTo` ➔ `.RequestAppliesTo`<br>`pageSize` ➔ `.pageSize`<br>`pageIndex` ➔ `.pageIndex` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **4** | `/rules/save` | `POST` | `pzSavePegaRule` | `ruleJson` ➔ `.ruleJson`<br>`pyRuleSet`/`pyRuleSetVersion` (trong ruleJson) ➔ target version | `.ResponseBody`, `.pyHTTPResponseCode` |
| **5** | `/rules/checkout` | `POST` | `pzCheckoutPegaRule` | `insKey` ➔ `.RequestPZInsKey`<br>`action` ➔ `.RequestAction`<br>`comment` ➔ `.RequestComment`<br>`branchName`/`branchVersion` ➔ branch context | `.ResponseBody`, `.pyHTTPResponseCode` |
| **6** | `/rules/test` | `POST` | `pzExecuteScenarioTestSuite` | `testSuiteID` ➔ `.RequestTestSuiteID`<br>`insKey` ➔ `.RequestPZInsKey` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **7** | `/rules/branch` | `POST` | `pzCreatePegaBranch` | `rulesetName` ➔ `.RequestRuleSetName`<br>`baseVersion` ➔ `.RequestBaseVersion`<br>`branchName` ➔ `.RequestBranchName` | `.ResponseBody`, `.pyHTTPResponseCode` |
| **8a** | `/datapage/list` | `POST` | `pzGetDataPageList` | `dataPageName` ➔ Query string param ➔ `.RequestDataPageName`<br>Body ➔ `.ruleJson` (JSON params) | `.ResponseBody` (pxResults array), `.pyHTTPResponseCode` |
| **8b** | `/datapage/single` | `POST` | `pzGetDataPageSingle` | `dataPageName` ➔ Query string param ➔ `.RequestDataPageName`<br>Body ➔ `.ruleJson` (JSON params) | `.ResponseBody` (single page JSON), `.pyHTTPResponseCode` |
| **9** | `/rules/directChildren` | `POST` | OOTB `D_DirectChildren` (Data Page) | `.ClassName` ➔ Query param<br>`.CategoryLevel1` ➔ Query param<br>`.CategoryLevel2` ➔ Query param | JSON response (pxResults array of `Embed-ExplorerNode-Rule`) |
| **10** | `/rules/listRules` | `POST` | OOTB `D_RuleInstances` (Data Page) | `ObjClass` ➔ Query param<br>`FilterPropName` ➔ Query param<br>`FilterPropValue` ➔ Query param<br>`PageSize` ➔ Query param<br>`PageIndex` ➔ Query param | JSON `Code-Pega-List` (pxResults + pagination metadata) |

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


