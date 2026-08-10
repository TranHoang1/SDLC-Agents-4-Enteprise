# SA4E-95: Composite Component Diagrams — All RuleForm Harnesses

## Summary

Fetched and parsed 11 Pega rules. Below are composite trees showing sections, controls, page context.

---

## 1. Data-Admin-Operator-ID::RuleForm (38KB)

```
[HARNESS] Data-Admin-Operator-ID::RuleForm  layout=harness
+-- [SECTION:S1] 'Header' container=NONE
|   +-- [INCLUDE] 'RuleFormMain'
|       +-- (resolves: @baseclass::RuleFormMain)
|           +-- pyPagesAndClasses:
|           |   page='pyWorkPage' -> Work-ProjectManagement
|           |   page='pyWorkPage.pyRulePage' -> Rule-
|           +-- [INCLUDE] 'pzRuleFormKeysAndDescription'
|           |   +-- R .pyObjClassLabel (pxDisplayText, readOnly)
|           |   +-- W .pyLabel (pxLink, editable)
|           |   +-- R .pyDelegateShortDescription (pxTextInput, readOnly)
|           |   +-- [SUB] pzRuleFormStatus
|           |   +-- [SUB] pzRuleFormHeaderCompareWithDropDown
|           +-- [INCLUDE] 'pzRuleFormRuleset'
|           +-- [INCLUDE] 'pzShowPageXML'
+-- [FOOTER] 3 layout slots (left/center/right)
```

---

## 2. Rule-Connect-REST::Methods (1.4MB — COMPLEX!)

```
[SECTION] Methods on Rule-Connect-REST
|
+-- [GET Method]
|   +-- [SEC:S2] 'Request'
|   |   +-- [SEC:S3] 'Headers'
|   |       +-- [REPEAT] list='.pyGETRequestHeaders' class='Embed-InterfaceParameter'
|   |           +-- W .pyParameterName (Default, readOnly)
|   |           +-- R .pyDesc (Default, readOnly)
|   |           +-- [INCLUDE] 'pzConnectParamMapFromOptions'
|   |           +-- [INCLUDE] 'pzConnectMapFromKey'
|   |           +-- W .pyTemplateInputBox (pxIconAddItem, editable)
|   +-- [SEC:S7] 'Additional query string parameters'
|   |   +-- [REPEAT] list='.pyGETRequestParameters' class='Embed-InterfaceParameter'
|   +-- [SEC:S11] 'Response'
|       +-- [SEC:S12] 'Headers'
|       |   +-- [REPEAT] list='.pyGETResponseHeaders' class='Embed-InterfaceParameter'
|       +-- [INCLUDE] 'pzConRESTMapPayloadTo' *** page=.pyPATCHResponseDataList(1) ***
|
+-- [POST Method] (same structure)
|   +-- [REPEAT] lists: .pyPOSTRequestHeaders, .pyPOSTRequestParameters
|   +-- [INCLUDE] 'pzConRESTMapPayloadTo' page=.pyPOSTResponseDataList(1)
|
+-- [PUT Method] (same structure)
|   +-- [REPEAT] lists: .pyPUTRequestHeaders, .pyPUTRequestParameters
|
+-- [PATCH Method]
|   +-- [INCLUDE] 'pzConRESTMapPayloadTo' page=.pyPATCHResponseDataList(1)
|
+-- [DELETE Method] (same structure)
```

**KEY FINDINGS:**
- `[REPEAT]` = TABLE control (iterates over page list property)
- `page=.pyPATCHResponseDataList(1)` = Section runs on INDEXED item in page list!
- Pattern: Request/Response x GET/POST/PUT/PATCH/DELETE

---

## 3. Rule-Declare-DecisionTable::RuleForm (28KB)

```
[HARNESS] Rule-Declare-DecisionTable::RuleForm
+-- pyPagesAndClasses: page='' class='Rule-Declare-DecisionTable'
+-- [SECTION:S1] -> [INCLUDE] 'RuleFormMain'
|
|   25 OWN sections:
|   - pzDecisionTable (80KB, TEMPLATE layout - JS-rendered grid)
|   - pzDecisionTableComponentSection
|   - pzRuleFormPagesAndClasses -> [INCLUDE] 'RuleFormPagesAndClassesNoMode'
|   - pzRuleFormParameters
|   - pzTestCases
```

---

## 4. Rule-Obj-Model (Data Transform)::RuleForm (29KB)

```
[HARNESS] Rule-Obj-Model::RuleForm
+-- [SECTION:S1] -> [INCLUDE] 'RuleFormMain'
|
|   18 OWN sections:
|   - pzDefinition (main DT editor - TEMPLATE layout)
|   - pzEditDefinition, pzExpressRuleContent
|   - RuleFormLayout (OVERRIDE of @baseclass!)
|   - pzConfigureDataTransformParameters
|   - pzViewAsActivity
```

---

## 5. Rule-Obj-When::RuleForm (29KB)

```
[HARNESS] Rule-Obj-When::RuleForm
+-- [SECTION:S1] -> [INCLUDE] 'RuleFormMain'
|
|   28 OWN sections:
|   - pzConditions, pzConditionTree, pzConditionBuilderView
|   - pzAdvanced, pzAdvancedConditions
|   - pxConditionBuilderExpress
|   - RuleFormLayout (OVERRIDE!)
```

---

## 6. Rule-Obj-Report-Definition::RuleForm (42KB)

```
[HARNESS] Rule-Obj-Report-Definition::RuleForm
+-- [SECTION:S1] -> [INCLUDE] 'RuleFormMain'
|
|   87 OWN sections (most complex):
|   - RuleFormLayout (OVERRIDE!)
|   - pzReportExplorer, pzReportExplorerWrapper
|   - pzReportViewerUserActions
|   - pzPromptFiltersGrid
|   - RuleFormParameters, RuleFormPagesAndClasses
```

---

## CONTROL TYPE CATALOG (Proven from actual data)

### Cell Types (pyType)

| pyType | Meaning |
|--------|---------|
| FIELD | Property-bound control (format determines widget) |
| LABEL | Static text |
| SUB_SECTION | Embedded section inline |
| LAYOUT | Nested layout container |
| BUTTON | Action button |
| LINK | Hyperlink |
| SEPARATOR | Visual separator |
| ICON | Icon |

### pyFormat (determines actual widget for FIELD)

| pyFormat | Widget |
|----------|--------|
| pxDisplayText | Read-only text display |
| pxTextInput | Text input |
| pxLink | Clickable link |
| pxIconAddItem | Add-item icon button |
| Default | Default rendering for property type |
| pxDropdown | Dropdown (known from Pega docs) |
| pxCheckbox | Checkbox |
| pxRadioButtons | Radio group |
| pxDateTime | Date picker |
| pxTextArea | Multi-line textarea |
| pxAutoComplete | Autocomplete input |

### Layout/Body Types

| Type | Meaning | Key Properties |
|------|---------|---------------|
| SIMPLELAYOUT | Grid with rows/cells | pyColumnCount, pyRows |
| FREEFORM | Free-form layout | pyRows |
| TEMPLATE | JS-rendered (runtime) | Cannot parse statically |
| INCLUDE | Include section | pyInclude, pyUsingPage |
| REPEAT (pyPageListProperty) | Table/Grid | pyPageListProperty, pyPageListPropertyClass |

### pyUsingPage Values (Page Context)

| Value | Type | Meaning |
|-------|------|---------|
| (empty) | Primary | Runs on harness primary page |
| `.pyPATCHResponseDataList(1)` | Indexed list | Item at index 1 in page list |
| `.pyPOSTResponseDataList(1)` | Indexed list | Item at index 1 in page list |
| `D_SomePage` | Data Page | Runs on declared data page |
| `pyWorkPage` | Clipboard | Top-level work page |
| `.someProperty` | Relative | Property on current page |

---

## OOP Evidence: Override Pattern

ALL rule types share SAME harness template:
```
Harness → pySections[0] → INCLUDE 'RuleFormMain'
```

Differentiation happens via class-specific SECTION OVERRIDES:

| Class | Sections Count | Key Override |
|-------|---------------|-------------|
| @baseclass | base | RuleFormMain, pzRuleFormKeysAndDescription |
| Rule-Obj-Activity | 35 | RuleFormLayout, pzSteps, pzDefinition |
| Rule-Obj-Model | 18 | RuleFormLayout, pzDefinition |
| Rule-Obj-When | 28 | RuleFormLayout, pzConditions |
| Rule-Declare-DecisionTable | 25 | RuleFormLayout, pzDecisionTable |
| Rule-Connect-REST | 27 | Methods, AuthConfig |
| Rule-Obj-Report-Definition | 87 | RuleFormLayout, pzReportExplorer |

**Rule resolution: most-specific class wins. Any superclass section can be overridden.**
