# Pega Rule Definition API — Hướng Dẫn Lấy Rule Definition

Tài liệu này mô tả cách lấy **Rule Definition** (Class Definition, Property Definition, Rule Metadata) từ Pega thông qua một **Java Activity Service** nội bộ.

> **Ghi chú kỹ thuật**: Pega REST API public (`/api/v1/`) **không cung cấp** endpoint để lấy raw Rule Object Definition. Phải dùng Java Activity nội bộ gọi `tools.getDatabase().open(pzInsKey, false)` để truy cập ClipboardPage của Rule.

---

## 1. Kiến Trúc Truy Vấn Rule Definition

```
Client (Code Intelligence)
    │
    ▼
Pega Service REST (api package)
    │  POST /api/v1/data/D_RuleDefinition?ClassName=Rule-Obj-Activity
    ▼
Java Activity: GetRuleDefinition
    │
    ├── tools.getDatabase().open("RULE-OBJ-CLASS RULE-OBJ-ACTIVITY", false)
    │       └── Returns ClipboardPage with full Rule-Obj-Class data
    │
    └── resPage.getJSON(false)
            └── Returns complete JSON of the ClipboardPage
```

---

## 2. Java Activity Code (Minimal & Correct)

```java
String clsName = tools.getPrimaryPage().getString(".pyClassName");

com.pega.pegarules.pub.database.ClassDefinition classDef = tools.getDatabase().getClassDef(clsName);
String exception = "";
com.pega.pegarules.pub.clipboard.ClipboardPage resPage = null;
try{
    String clsPZInskey = ("RULE-OBJ-CLASS " + clsName).toUpperCase();
    resPage = tools.getDatabase().open(clsPZInskey, false);
} catch(DatabaseException ex) {
    exception = ex.getMessage();
}

if (classDef != null && resPage != null) {
    tools.getParameterPage().putString("ClassPZInskey", "["+clsPZInskey+"]");
    resPage.putString("pyClassName", classDef.getName());
    resPage.putString("pyRuleSet", classDef.getRuleSetName());
    
    com.pega.pegarules.pub.database.ClassDefinition dirParent = classDef.getDirectedParent();
    if (dirParent != null) {
        resPage.putString("pySuperClass", dirParent.getName());
    }
    
    com.pega.pegarules.pub.database.ClassDefinition patParent = classDef.getPatternParent();
    if (patParent != null) {
        resPage.putString("pyPatternParent", patParent.getName());
    }
    
    java.util.Map propMap = classDef.getPropertyToColumnMap();
    if (propMap != null) {
        for (Object key : propMap.keySet()) {
            com.pega.pegarules.pub.clipboard.ClipboardPage pPage = tools.createPage("Embed-CustomFields", "");
            pPage.putString("pyPropertyName", key.toString());
            pPage.putString("pyColumnName", propMap.get(key) != null ? propMap.get(key).toString() : "");
            
            resPage.getProperty("pxResults").add(pPage);
        }
    }
    
    tools.getPrimaryPage().putString("pyNote", resPage.getJSON(false));
} else {
    tools.getPrimaryPage().putString("pyNote", "{\"error\":\"ClassDefinition not found or "+exception+" for className: " + clsName + "\"}");
}
```

### Giải Thích

| Dòng code | Mục đích |
|---|---|
| `tools.getPrimaryPage().getString(".pyClassName")` | Lấy tên class từ input parameter |
| `("RULE-OBJ-CLASS " + clsName).toUpperCase()` | Build pzInsKey chuẩn Pega |
| `tools.getDatabase().open(pzInsKey, false)` | Load toàn bộ ClipboardPage của rule từ DB |
| `resPage.getJSON(false)` | Serialize ClipboardPage thành JSON compact |

---

## 3. pzInsKey Convention

Mỗi Rule trong Pega có `pzInsKey` theo format: `{RULE-TYPE-CLASS} {CLASS_NAME} [{RULE_KEYS...}]`

| Rule Type | pzInsKey |
|---|---|
| Class Definition | `RULE-OBJ-CLASS RULE-OBJ-ACTIVITY` |
| Activity | `RULE-OBJ-ACTIVITY TGB-HRAPPS-WORK-CANDIDATE SUBMITAPPLICATION` |
| Data Transform | `RULE-OBJ-MODEL TGB-HRAPPS-WORK-CANDIDATE INITIALIZEDATA` |
| Data Page | `RULE-DECLARE-PAGES TGB-HRAPPS-WORK CANDIDATE D_CANDIDATELIST` |
| Flow | `RULE-OBJ-FLOW TGB-HRAPPS-WORK-CANDIDATE NEWCANDIDATE` |
| Validate | `RULE-OBJ-VALIDATE TGB-HRAPPS-WORK-CANDIDATE VALIDATECANDIDATEDATA` |
| Decision Table | `RULE-DECLARE-DECISIONTABLE TGB-HRAPPS-WORK GETPRIORITYLEVEL` |

---

## 4. JSON Response — Fields Quan Trọng

### 4.1 Class Definition Fields

| Field | Ví Dụ | Mô Tả |
|---|---|---|
| `pzInsKey` | `"RULE-OBJ-CLASS RULE-OBJ-ACTIVITY"` | Primary key |
| `pyClassName` | `"Rule-Obj-Activity"` | Tên class |
| `pySuperClass` | `"Rule-Obj-"` | Directed Parent (kế thừa trực tiếp) |
| `pyPatternParent` | `"Rule-Obj-"` | Pattern Parent (kế thừa theo tên) |
| `pyDerivesFrom` | `"Rule-Obj-"` | Base class |
| `pyRuleSet` | `"Pega-RULES"` | Thuộc RuleSet |
| `pyClassType` | `"Concrete"` | Concrete hoặc Abstract |
| `pyLabel` | `"Activity"` | Display label |
| `pyDescription` | `"Class Definition for..."` | Mô tả |
| `pyClassInheritance` | `"true"` | Directed inheritance enabled |
| `pyPatternInheritance` | `"true"` | Pattern inheritance enabled |
| `pyHasInstances` | `"true"` | Có instances trong DB |
| `pyIsCoreClass` | `"false"` | Core Platform class |
| `pyCreateDedicatedTable` | `"true"` | Có dedicated DB table |

### 4.2 pyKeyDefList — Key Structure (CRITICAL)

Cho biết key structure để build pzInsKey của rule instances:

```json
"pyKeyDefList": [
  { "pyKeyCaption": "Applies To",    "pyKeyName": "pyClassName" },
  { "pyKeyCaption": "Activity Name", "pyKeyName": "pyActivityName" }
]
```

> Từ `pyKeyDefList` ta biết: `RULE-OBJ-ACTIVITY {pyClassName} {pyActivityName}`

### 4.3 pxRuleReferences — Dependencies

```json
"pxRuleReferences": [
  {
    "pxRuleObjClass": "Rule-Obj-Class",
    "pxRuleClassName": "Rule-Obj-",
    "pyRuleName": "Rule-Obj-",
    "pzIndexOwnerKey": "RULE-OBJ-CLASS RULE-OBJ-ACTIVITY"
  }
]
```

---

## 5. Mapping Sang TypeScript Interface

```typescript
// models/PegaClassDefinition.ts
export interface PegaClassKeyDef {
  pyKeyName: string;     // "pyActivityName"
  pyKeyCaption: string;  // "Activity Name"
}

export interface PegaRuleReference {
  pxRuleObjClass: string;   // "Rule-Obj-Class"
  pxRuleClassName: string;  // "Rule-Obj-"
  pyRuleName: string;       // "Rule-Obj-"
  pzIndexOwnerKey: string;  // "RULE-OBJ-CLASS RULE-OBJ-ACTIVITY"
}

export interface PegaClassDefinition {
  pzInsKey: string;
  pxObjClass: string;
  pyClassName: string;
  pyLabel: string;
  pyDescription: string;
  pyRuleSet: string;
  pySuperClass: string;       // Directed parent
  pyPatternParent: string;    // Pattern parent
  pyDerivesFrom: string;
  pyClassType: string;        // "Concrete" | "Abstract"
  pyClassInheritance: string;
  pyPatternInheritance: string;
  pyHasInstances: string;
  pyIsCoreClass: string;
  pyKeyDefList: PegaClassKeyDef[];
  pxRuleReferences: PegaRuleReference[];
}
```

---

## 6. Build pzInsKey Từ pyKeyDefList

```typescript
export function buildPzInsKey(
  ruleObjClass: string,
  classDef: PegaClassDefinition,
  keyValues: Record<string, string>
): string {
  const keyParts = classDef.pyKeyDefList
    .filter(k => k.pyKeyName)
    .map(k => (keyValues[k.pyKeyName] || '').toUpperCase());
  return [ruleObjClass.toUpperCase(), ...keyParts].join(' ');
}

// Ví dụ:
// buildPzInsKey("RULE-OBJ-ACTIVITY", classDef, {
//   pyClassName: "TGB-HRApps-Work-Candidate",
//   pyActivityName: "SubmitApplication"
// })
// → "RULE-OBJ-ACTIVITY TGB-HRAPPS-WORK-CANDIDATE SUBMITAPPLICATION"
```

---

## 7. Dual-Axis Inheritance Resolution

Từ response: `pySuperClass = "Rule-Obj-"` và `pyPatternParent = "Rule-Obj-"`

```typescript
export function getClassAncestry(
  className: string,
  classMap: Map<string, PegaClassDefinition>
): string[] {
  const ancestry: string[] = [className];
  let current = classMap.get(className);
  while (current?.pySuperClass && current.pySuperClass !== className) {
    ancestry.push(current.pySuperClass);
    current = classMap.get(current.pySuperClass);
  }
  if (!ancestry.includes('@baseclass')) ancestry.push('@baseclass');
  return ancestry;
}
```

---

## 8. Lỗi Thường Gặp

| Lỗi | Nguyên Nhân | Cách Xử Lý |
|---|---|---|
| `resPage = null` | Class không tồn tại trong DB | Check exception message |
| `DatabaseException` | DB không accessible | Catch và return error JSON |
| JSON empty `{}` | pzInsKey sai format | Kiểm tra UPPERCASE và space convention |
| `getJSON()` không compile | Sai method signature | Dùng `getJSON(false)` — param là boolean |

---

## 9. Sample Response Thực Tế (Rule-Obj-Activity)

```json
{
  "pxObjClass": "Rule-Obj-Class",
  "pzInsKey": "RULE-OBJ-CLASS RULE-OBJ-ACTIVITY",
  "pyClassName": "Rule-Obj-Activity",
  "pySuperClass": "Rule-Obj-",
  "pyPatternParent": "Rule-Obj-",
  "pyDerivesFrom": "Rule-Obj-",
  "pyRuleSet": "Pega-RULES",
  "pyClassType": "Concrete",
  "pyLabel": "Activity",
  "pyClassInheritance": "true",
  "pyPatternInheritance": "true",
  "pyHasInstances": "true",
  "pyIsCoreClass": "false",
  "pyKeyDefList": [
    { "pyKeyCaption": "Applies To",    "pyKeyName": "pyClassName" },
    { "pyKeyCaption": "Activity Name", "pyKeyName": "pyActivityName" }
  ],
  "pxRuleReferences": [
    {
      "pxRuleObjClass": "Rule-Obj-Class",
      "pxRuleClassName": "Rule-Obj-",
      "pyRuleName": "Rule-Obj-"
    }
  ]
}
```

---

*Last Updated: 2026-07-26 | Source: Pega HRAppsV2 + CommonBase RAP + Live getJSON() output*
