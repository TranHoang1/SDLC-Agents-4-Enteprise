# SA4E-95: Pega RuleForm Harness — Section & Context Analysis

## Tóm tắt phát hiện

Sau khi fetch và phân tích RuleForm harness (`Data-Admin-Operator-ID`) và section (`RuleFormMain` trên `@baseclass`), đây là cách Pega lưu trữ **sections** và **context** trong JSON:

---

## 1. Hierarchy: Harness → Section → Sub-sections

```
Rule-HTML-Harness (RuleForm)
  pyClassName = "Data-Admin-Operator-ID"     <- Class mà harness applies-to
  pyPagesAndClasses = []                     <- Context pages tại harness level
  pySections = [                             <- Layout slots (header, body, footer)
    {
      pxObjClass: "Embed-Harness-Section"
      pySectionId: "S1"
      pyTitle: "Header"
      pySectionBody: [
        {
          pxObjClass: "Embed-Harness-SectionBody"
          pyBodyType: "INCLUDE"              <- Chứa section khác
          pyInclude: "RuleFormMain"           <- Tên Section được include
          pyUsingPage: ""                    <- PAGE CONTEXT (rỗng = primary page)
        }
      ]
    }
  ]
  pyHeaderActions = {...}                    <- Header toolbar
  pyFooterActions = [...]                    <- Footer buttons
```

---

## 2. CÁC PROPERTY QUYẾT ĐỊNH CONTEXT

### A. Tại Harness Level

| Property | Vị trí | Ý nghĩa |
|----------|--------|----------|
| `pyClassName` | Top-level | Class mà harness applies-to (primary page class) |
| `pyPagesAndClasses` | Top-level array | Khai báo pages + classes available trong harness |
| `pyPagesAndClasses[].pyPagesAndClassesPage` | | Tên page (e.g. `pyWorkPage`, `D_OperatorList`) |
| `pyPagesAndClasses[].pyPagesAndClassesClass` | | Class của page đó |
| `pyPagesAndClasses[].pyPagesAndClassesMode` | | Mode: (empty=normal), `readOnly`, etc. |

### B. Tại Section Body Level (`pySections[].pySectionBody[]`)

| Property | Ý nghĩa | Ví dụ |
|----------|----------|-------|
| `pyBodyType` | Loại body | `INCLUDE`, `SIMPLELAYOUT`, `REPEATLAYOUT`, `DPLAYOUT` |
| `pyInclude` | Tên section được include | `RuleFormMain`, `pzSteps` |
| **`pyUsingPage`** | PAGE CONTEXT — Section chạy trên page nào | `pyWorkPage`, `D_OperatorList`, `.pyRulePage` |
| `pyPageListProperty` | Cho repeat layout — property chứa page list | `pySteps`, `pyParameters` |
| `pyPageListPropertyClass` | Class của items trong page list | `Embed-Activity-Steps` |
| `pyPassCurrentParameterPage` | Pass parameter page xuống section | `true/false` |

### C. Tại Section Rule Level (Rule-HTML-Section)

| Property | Ý nghĩa | Ví dụ |
|----------|----------|-------|
| `pyClassName` | Section applies-to class | `@baseclass`, `Rule-Obj-Activity` |
| `pyPageName` | Page reference nickname | `RH_1` (auto-generated) |
| `pyPagesAndClasses` | Context pages khai báo BÊN TRONG section | (see below) |
| `pxNamedPageReferences` | RUNTIME page references section thực sự dùng | `pyWorkPage -> Work-ProjectManagement` |

---

## 3. pyPagesAndClasses — Chi tiết

Array khai báo tất cả pages + classes mà section có thể truy cập:

```json
"pyPagesAndClasses": [
  {
    "pxObjClass": "Embed-PagesAndClasses",
    "pyPagesAndClassesPage": "pyWorkPage",
    "pyPagesAndClassesClass": "Work-ProjectManagement",
    "pyPagesAndClassesMode": ""
  },
  {
    "pyPagesAndClassesPage": "pyWorkPage.pyRulePage",
    "pyPagesAndClassesClass": "Rule-",
    "pyPagesAndClassesMode": ""
  },
  {
    "pyPagesAndClassesPage": "",
    "pyPagesAndClassesClass": "@baseclass",
    "pyPagesAndClassesMode": ""
  }
]
```

### Ý nghĩa từng Page Reference:

| pyPagesAndClassesPage | Loại | Ý nghĩa |
|----------------------|------|----------|
| (empty) | Primary | Primary page — page mà rule đang chạy trên |
| `pyWorkPage` | Clipboard | Top-level clipboard page (work item) |
| `pyWorkPage.pyRulePage` | Nested | Nested page: property `.pyRulePage` trên `pyWorkPage` |
| `D_OperatorList` | Data Page | Declare page loaded by system |
| `.pyParameters` | Relative | Property reference (relative to primary page) |
| `Clipboard.pyActiveThread` | Clipboard | System clipboard page |

---

## 4. pxNamedPageReferences — Runtime Context

```json
"pxNamedPageReferences": [
  {
    "pxObjClass": "Embed-Reference-NamedPage",
    "pxPageName": "pyWorkPage",
    "pxPageClass": "Work-ProjectManagement"
  }
]
```

Danh sách pages THỰC SỰ được dùng khi section render. Pega engine resolve từ `pyPagesAndClasses` + actual clipboard state.

---

## 5. pyBodyType VALUES

| pyBodyType | Mô tả | Context xác định bởi |
|------------|--------|---------------------|
| `INCLUDE` | Include 1 section khác | `pyUsingPage` |
| `SIMPLELAYOUT` | Layout trực tiếp (rows/cells) | Primary page |
| `REPEATLAYOUT` | Lặp qua page list | `pyPageListProperty` + `pyPageListPropertyClass` |
| `DPLAYOUT` | Data Page layout | `pyDPResultsClass` |
| `TABBED` | Tabbed sections | Mỗi tab có `pyUsingPage` riêng |

---

## 6. Algorithm: Xác định Section chạy trên Class/Page nào

```
1. Đọc harness.pyClassName -> PRIMARY page class

2. Đọc harness.pyPagesAndClasses -> tất cả context pages available

3. Với mỗi section trong pySections[].pySectionBody[]:
   a. pyUsingPage = "" (rỗng)
      -> Section chạy trên PRIMARY page (= harness.pyClassName)
   
   b. pyUsingPage = "pyWorkPage"
      -> Tìm class trong pyPagesAndClasses where page="pyWorkPage"
   
   c. pyUsingPage = ".pySteps(N)" hoặc pyPageListProperty
      -> Section lặp qua page list
      -> Class từ pyPageListPropertyClass
   
   d. pyUsingPage = "D_SomePage"
      -> Data Page context
      -> Class từ pyPagesAndClasses hoặc Data Page definition

4. Fetch section rule riêng nếu cần chi tiết:
   - section.pyPagesAndClasses -> context pages CỦA section
   - section.pxNamedPageReferences -> actual runtime pages
```

---

## 7. API Flow để lấy Section + Context

```
Step 1: GET /rules/listRules?ObjClass=Rule-HTML-Harness&FilterPropName=pyStreamName&FilterPropValue=RuleForm
        -> Lấy danh sách harnesses + pzInsKey

Step 2: GET /rules/{pzInsKey}
        -> Lấy full harness JSON

Step 3: Parse harness JSON:
        - harness.pyClassName = PRIMARY CLASS
        - harness.pyPagesAndClasses = ALL AVAILABLE PAGES/CLASSES
        - harness.pySections[].pySectionBody[]:
          - pyBodyType = loại section
          - pyInclude = tên section con
          - pyUsingPage = PAGE CONTEXT
          - pyPageListProperty = page list property
          - pyPageListPropertyClass = items class

Step 4: Nếu cần chi tiết section:
        GET /rules/listRules?ObjClass=Rule-HTML-Section&FilterPropName=pyStreamName&FilterPropValue={pyInclude}
        -> Lấy section pzInsKey -> GET /rules/{pzInsKey}
        - section.pyPagesAndClasses = SECTION'S OWN CONTEXT
        - section.pxNamedPageReferences = RUNTIME PAGE BINDINGS
```

---

## 8. Key JSON Properties Summary

| Level | Property | Provides |
|-------|----------|----------|
| Harness | `pyClassName` | Primary class (rule applies-to) |
| Harness | `pyPagesAndClasses[].pyPagesAndClassesPage` | Page name |
| Harness | `pyPagesAndClasses[].pyPagesAndClassesClass` | Page class |
| Harness→Section | `pySectionBody[].pyInclude` | Section name |
| Harness→Section | `pySectionBody[].pyUsingPage` | Context page for section |
| Harness→Section | `pySectionBody[].pyPageListProperty` | Page list property |
| Harness→Section | `pySectionBody[].pyPageListPropertyClass` | Items class in list |
| Section rule | `pyClassName` | Section's applies-to |
| Section rule | `pyPagesAndClasses` | Section's own page declarations |
| Section rule | `pxNamedPageReferences[].pxPageName` | Runtime page name |
| Section rule | `pxNamedPageReferences[].pxPageClass` | Runtime page class |

---

## 8. Nested Section Deep Dive

### 8.1 Harness → Section Chain thực tế (Rule-Obj-Activity RuleForm)

```
Harness: Rule-Obj-Activity RuleForm
  └── pySections[0] → include='RuleFormMain' (pyUsingPage='')
        └── RuleFormMain (@baseclass, 188KB)
              ├── pyPagesAndClasses:
              │     page='pyWorkPage'            class='Work-ProjectManagement'
              │     page='pyWorkPage.pyRulePage'  class='Rule-'
              │     page=''                       class='@baseclass'
              ├── pxNamedPageReferences:
              │     pxPageName='pyWorkPage'       pxPageClass='Work-ProjectManagement'
              └── pySections:
                    [S1] → include='pzRuleFormKeysAndDescription' (primary)
                    [S1] → include='pzRuleFormRuleset' (primary)
                    [S6] → include='pzShowPageXML' (primary)
```

### 8.2 Case Management Chain (Work- Perform)

```
Harness: Work- Perform (43KB, pyLayoutType='portal')
  └── pySections → includes:
        'pxCaseTopHeaderWrapper' (primary)
        'pxCaseMain' (primary)
              └── pxCaseMain (Work-, 220KB)
                    ├── pyPagesAndClasses:
                    │     page='newAssignPage'  class='Assign-'  ← ASSIGNMENT CONTEXT!
                    └── includes (all pyUsingPage=''):
                          'WorkList'
                          'pyCaseMainInnerWrapper'
                          'pyCasePreview'
                          'pyCaseInfo'
                          'pxDisplayStages'
                          'pxAssignmentView'
                          'pyCaseActionArea'
                          'pyCaseConfirm'
                          'pxCaseMainInc'
```

### 8.3 Activity Definition Chain

```
Harness: Rule-Obj-Activity RuleForm
  └── Section: RuleFormLayout (57KB)
        ├── include='RuleFormHeader'
        └── include='pzRuleFormLayoutInner' (125KB)
              └── pySections: [S1], [S2] — SIMPLELAYOUT only
                    (Steps are rendered dynamically, not as static includes)
```

### 8.4 Key Observation: pyUsingPage rỗng trong OOTB

Trong tất cả sections OOTB đã phân tích:
- `pyUsingPage` = rỗng (100% trường hợp)
- Context switching xảy ra qua:
  1. `pyPagesAndClasses` khai báo tại section level (e.g. `newAssignPage` -> `Assign-`)
  2. Dynamic runtime: Flow Action, Activity, Data Transform load data vào clipboard pages
  3. Section runtime engine tự resolve dựa trên primary page

`pyUsingPage` có giá trị KHI:
- Custom sections include sub-section chạy trên page KHÁC primary
- Ví dụ: Section "OrderDetails" include "LineItems" với `pyUsingPage='.pyLineItems'`
- Hoặc include section chạy trên Data Page: `pyUsingPage='D_CustomerProfile'`

---

## 9. Kết luận cho Schema Generator (SA4E-95)

### Context extraction algorithm:

```
function extractSectionContext(harness):
  primaryClass = harness.pyClassName
  
  // Level 1: Harness pyPagesAndClasses
  contextPages = harness.pyPagesAndClasses.map(p => ({
    page: p.pyPagesAndClassesPage,
    class: p.pyPagesAndClassesClass,
    mode: p.pyPagesAndClassesMode
  }))
  
  // Level 2: Section bodies
  for each sectionBody in harness.pySections[].pySectionBody[]:
    if sectionBody.pyUsingPage != '':
      sectionContext = resolvePageClass(sectionBody.pyUsingPage, contextPages)
    else:
      sectionContext = primaryClass
    
    if sectionBody.pyBodyType == 'INCLUDE':
      nestedSection = fetchSection(sectionBody.pyInclude, primaryClass)
      nestedPages = nestedSection.pyPagesAndClasses
      nestedRuntimePages = nestedSection.pxNamedPageReferences
      // Recurse...

function resolvePageClass(pyUsingPage, contextPages):
  if pyUsingPage starts with 'D_': return DataPage class
  if pyUsingPage starts with '.': return property reference class
  match = contextPages.find(p => p.page == pyUsingPage)
  return match?.class || '@baseclass'
```

### Critical fields per level:

| Depth | Rule Type | Key Context Fields |
|-------|-----------|-------------------|
| 0 | Harness | `pyClassName`, `pyPagesAndClasses` |
| 1 | pySectionBody | `pyInclude`, `pyUsingPage`, `pyPageListProperty`, `pyPageListPropertyClass` |
| 2 | Section Rule | `pyClassName`, `pyPagesAndClasses`, `pxNamedPageReferences` |
| 3 | Nested Body | Same as depth 1 — recursion |

---

## 10. Raw Data Files

- `ruleform-operator-id-raw.json` — Full Harness: Data-Admin-Operator-ID RuleForm (38KB)
- `section-ruleformmain-raw.json` — Full Section: RuleFormMain on @baseclass (188KB)
- `section-pzSteps-raw.json` — Full Section: pzSteps on Rule-Obj-Activity (131KB)
- `section-ruleformlayout-activity.json` — Section: RuleFormLayout on Rule-Obj-Activity (57KB)
- `section-layout-inner-activity.json` — Section: pzRuleFormLayoutInner (125KB)
- `harness-work-perform.json` — Harness: Work- Perform (43KB)
- `section-pxCaseMain.json` — Section: pxCaseMain on Work- (220KB)
- `section-pzDefinition-activity.json` — Section: pzDefinition on Rule-Obj-Activity (527KB)
- `harness-service-mcp.json` — Harness: Rule-Service-MCP RuleForm (32KB)
