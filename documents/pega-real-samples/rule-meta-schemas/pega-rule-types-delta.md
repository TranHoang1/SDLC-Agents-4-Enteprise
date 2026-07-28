# Pega Rule Types — Delta Analysis: Current (110 files) vs Official (140+ concrete types)

## Source: Pega v7.18 Official Rule Type Index
https://community.pega.com/sites/pdn.pega.com/files/help_v718/rule-/ruleindex.htm

---

## 84 Concrete Types We HAVE (in schemas/rules/)

### Data (3)
Data-Admin-DB-ClassGroup, Data-Admin-DB-Table

### Access (5)
Rule-Access-Deny-Obj, Rule-Access-Privilege, Rule-Access-Role-Name, Rule-Access-Role-Obj, Rule-Access-When

### Admin (1)
Rule-Admin-Product

### Agent (1)
Rule-Agent-Queue

### Async (2)
Rule-Async-JobScheduler, Rule-Async-QueueProcessor

### Connect (9)
Rule-Connect-CMIS, Rule-Connect-EJB, Rule-Connect-File, Rule-Connect-HTTP, Rule-Connect-JMS, Rule-Connect-MQ, Rule-Connect-REST, Rule-Connect-SOAP, Rule-Connect-SQL

### Decision (5)
Rule-Decision-AdaptiveModel, Rule-Decision-Interaction, Rule-Decision-PredictiveModel, Rule-Decision-Scorecard, Rule-Decision-Strategy

### Declare (10)
Rule-Declare-Collection, Rule-Declare-Constraint, Rule-Declare-DecisionTable, Rule-Declare-DecisionTree, Rule-Declare-Expressions, Rule-Declare-Index, Rule-Declare-OnChange, Rule-Declare-Pages, Rule-Declare-Trigger

### Edit (1)
Rule-Edit-Validate

### File (2)
Rule-File-Binary, Rule-File-Text

### HTML (3)
Rule-HTML-Harness, Rule-HTML-Property, Rule-HTML-Section

### Map (1)
Rule-Map-Structured

### Obj (16)
Rule-Obj-Activity, Rule-Obj-CaseType, Rule-Obj-Class, Rule-Obj-Corr, Rule-Obj-Flow, Rule-Obj-FlowAction, Rule-Obj-HTML, Rule-Obj-ListView, Rule-Obj-MapValue, Rule-Obj-Model, Rule-Obj-Property, Rule-Obj-Report-Definition, Rule-Obj-ServiceLevel, Rule-Obj-Stage, Rule-Obj-SummaryView, Rule-Obj-Ticket, Rule-Obj-Validate, Rule-Obj-When, Rule-Obj-XML

### Parse (3)
Rule-Parse-Delimited, Rule-Parse-Structured, Rule-Parse-XML

### Portal (1)
Rule-Portal

### RDB (1)
Rule-RDB-SQL

### RuleSet (2)
Rule-RuleSet-Name, Rule-RuleSet-Version

### Service (7)
Rule-Service-EJB, Rule-Service-File, Rule-Service-HTTP, Rule-Service-JMS, Rule-Service-MQ, Rule-Service-REST, Rule-Service-SOAP

### Stream (1)
Rule-Stream

### Test (2)
Rule-Test-Suite, Rule-Test-Unit-Case

### UI (4)
Rule-UI-Component, Rule-UI-Paragraph, Rule-UI-Theme, Rule-UI-View

### Utility (2)
Rule-Utility-Function, Rule-Utility-Library

### Other (1)
Rule-Application

### Abstract parents NOT counted (26 files)
@baseclass, Data-, Data-Admin-, Data-Admin-DB-, Rule-, Rule-Access-, Rule-Access-Deny-, Rule-Access-Role-, Rule-Admin-, Rule-Agent-, Rule-Async-, Rule-Connect-, Rule-Decision-, Rule-Declare-, Rule-Edit-, Rule-File-, Rule-Map-, Rule-Obj-, Rule-Obj-Report-, Rule-Parse-, Rule-RDB-, Rule-RuleSet-, Rule-Service-, Rule-Test-, Rule-UI-, Rule-Utility-

---

## 56+ Concrete Types MISSING — Need to Download

### Access (1)
1. `Rule-Access-Setting` — Access Setting rule

### Admin (3)
2. `Rule-Admin-Extract` — Extract rule
3. `Rule-Admin-Skill` — Skill rule
4. `Rule-Admin-System-Settings` — System Settings rule

### Alias (1)
5. `Rule-Alias-Function` — Function Alias

### Application (2)
6. `Rule-Application-Requirement` — Application Requirement (linked requirement)
7. `Rule-Application-UseCase` — Application Use Case

### AutoTest (3)
8. `Rule-AutoTest-Case` — PegaUnit Test Case (may overlap with Rule-Test-Unit-Case)
9. `Rule-AutoTest-Case-FlowMarker` — Auto Test Flow Marker
10. `Rule-AutoTest-Suite` — PegaUnit Test Suite (may overlap with Rule-Test-Suite)

### Category (1)
11. `Rule-Category` — Rule Category

### Circumstance (2)
12. `Rule-Circumstance-Definition` — Circumstance Definition
13. `Rule-Circumstance-Template` — Circumstance Template

### Connect (3)
14. `Rule-Connect-dotNet` — .NET Connector
15. `Rule-Connect-Java` — Java Connector
16. `Rule-Connect-JCA` — JCA Connector

### Corr (2)
17. `Rule-Corr-Fragment` — Correspondence Fragment
18. `Rule-CorrType` — Correspondence Type

### Decision (3)
19. `Rule-Decision-DataSet` — Decision Data Set
20. `Rule-Decision-DDF` — Decision Data Flow
21. `Rule-Decision-DecisionData` — Decision Data

### Declare (1)
22. `Rule-Declare-CaseMatch` — Declare Case Match

### Define (1)
23. `Rule-Define-Hierarchy` — Define Hierarchy

### Edit (1)
24. `Rule-Edit-Input` — Edit Input

### File (2)
25. `Rule-File-Eform` — E-Form File
26. `Rule-File-Form` — Form File

### HTML (1)
27. `Rule-HTML-Fragment` — HTML Fragment

### Map (1)
28. `Rule-Map-Eform` — E-Form Map

### Message (1)
29. `Rule-Message` — Message rule

### Method (1)
30. `Rule-Method` — Method rule

### Navigation (1)
31. `Rule-Navigation` — Navigation rule

### Obj (7)
32. `Rule-Obj-Association` — Association
33. `Rule-Obj-AttachmentCategory` — Attachment Category
34. `Rule-Obj-Batch` — Batch rule
35. `Rule-Obj-FieldValue` — Field Value (localization)
36. `Rule-Obj-List` — List
37. `Rule-Obj-Property-Alias` — Property Alias
38. `Rule-Obj-Property-Qualifier` — Property Qualifier
39. `Rule-Obj-WorkParties` — Work Parties

### Parse (4)
40. `Rule-Parse-Infer` — Parse Infer
41. `Rule-Parse-Normalize` — Parse Normalize
42. `Rule-Parse-Transform` — Parse Transform
43. `Rule-Parse-TransformCollection` — Parse Transform Collection

### PegaQ (5)
44. `Rule-PegaQ-Question` — Survey Question
45. `Rule-PegaQ-QuestionCollection` — Survey Question Collection
46. `Rule-PegaQ-QuestionGroup` — Survey Question Group
47. `Rule-PegaQ-Questionnaire` — Survey Questionnaire
48. `Rule-PegaQ-SurveyBuilder` — Survey Builder

### Portal (1)
49. `Rule-PortalSkin` — Portal Skin

### Security (1)
50. `Rule-SecurityVA-Regex` — Security Vulnerability Regex

### Service (4)
51. `Rule-Service-Email` — Email Service (listens to email)
52. `Rule-Service-Java` — Java Service
53. `Rule-Service-JSR94` — JSR-94 Service
54. `Rule-Service-Portlet` — Portlet Service

### Shortcut (1)
55. `Rule-Shortcut` — Shortcut

### Template (1)
56. `Rule-Template-Word` — Word Template

---

## Also Check: Newer Rule Types (post-v7.18, may exist in Pega 8.x/24.x)
These are rule types we have that did NOT appear in the v7.18 index:

- `Rule-Stream` — Stream rule (real-time event processing, Infinity)
- `Rule-UI-Component` — UI Component (Constellation)
- `Rule-UI-Paragraph` — UI Paragraph
- `Rule-UI-Theme` — UI Theme
- `Rule-UI-View` — UI View (Constellation)
- `Rule-Obj-Stage` — Stage (part of CaseType in newer versions)
- `Rule-Async-JobScheduler` — Job Scheduler (renamed from agent?)
- `Rule-Async-QueueProcessor` — Queue Processor
- `Rule-Test-Unit-Case` — PegaUnit Test Case (may be Rule-AutoTest-Case renamed)
- `Rule-Test-Suite` — PegaUnit Test Suite (may be Rule-AutoTest-Suite renamed)

---

## Total Summary
| Category | Count |
|---|---|
| Current concrete schemas | 84 |
| Abstract/inheritance schemas | 26 |
| **Total schema files now** | **110** |
| **Concrete types MISSING** | **56** |
| **Potential total concrete types** | **~140** |

## Recommended Priority for Download
**Tier 1 (Core — high usage apps):**
Rule-Obj-FieldValue, Rule-Category, Rule-Message, Rule-Obj-WorkParties, Rule-Obj-Association, Rule-Connect-Java, Rule-Edit-Input, Rule-Navigation, Rule-Admin-System-Settings

**Tier 2 (Medium — common in enterprise apps):**
Rule-Decision-DataSet, Rule-Decision-DDF, Rule-Decision-DecisionData, Rule-Declare-CaseMatch, Rule-Obj-FieldValue, Rule-Obj-Property-Alias, Rule-Obj-Property-Qualifier, Rule-Obj-Batch, Rule-Service-Email, Rule-Service-Java

**Tier 3 (Specialized — less frequent):**
PegaQ survey types, Parse-* advanced, Rule-Circumstance-*, Rule-Admin-Skill, Rule-Admin-Extract, Rule-Application-Requirement, Rule-Application-UseCase, Rule-Shortcut, Alias, etc.
