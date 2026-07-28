# Pega Rule Test Data — Complete 166-Rule Sample Catalog

Bộ dữ liệu JSON mẫu **đầy đủ 166 loại Pega Rule** chia thành **14 nhóm** + **17 file standalone**.
Tất cả dùng ngữ cảnh ứng dụng nhất quán: **`PegaSampleLoan` v01.01.01** — class `PegaSample-CustomerLoan-Work-LoanApplication`.

---

## Group Files (14 nhóm — 166 rules tổng cộng)

| # | File | Nhóm Rule | Số Rule | Highlights |
|---|---|---|---|---|
| G01 | [group-01-process-case.json](./group-01-process-case.json) | Process & Case Management | 15 | Flow, FlowAction, CaseType, SLA, Workbasket, Corr, MapValue, Stage, Ticket, Route, WorkList, Assignment, ServiceLevel, ProcessStep, Step |
| G02 | [group-02-technical-logic.json](./group-02-technical-logic.json) | Technical & Logic | 15 | Activity, Function, Library, TextFile, HTMLFile, HTMLRule, XML, JS, CSS, Extract, Stream, Java, PropertyAlias, UtilityFile, Script |
| G03 | [group-03-data-declarative.json](./group-03-data-declarative.json) | Data Model & Declarative | 16 | Property, Class, DataTransform, DataPage, DeclareExpressions, DeclareTrigger, OnChange, Index, Constraint, FieldValue, ClassGroup, Keys, History, Strategy, Target, Collection |
| G04 | [group-04-decisioning-cdh.json](./group-04-decisioning-cdh.json) | Decisioning & CDH | 18 | DecisionTable, DecisionTree, When, Strategy, Scorecard, PredictiveModel, AdaptiveModel, Proposition, Taxonomy, Segment, Criterion, Container, PMML, TextAnalytics, ChampionChallenger, Interaction, Event, H2O |
| G05 | [group-05-ui-constellation.json](./group-05-ui-constellation.json) | UI & Constellation | 16 | Section, Harness, Control, Portal, Skin, View, BinaryFile, UIComponent, Navigation, Paragraph, Theme, Layout, FieldGroup, CardView, Icon, ControlMeta |
| G06 | [group-06-integration.json](./group-06-integration.json) | Integration Connectors & Services | 20 | ConnectREST, ConnectSQL, ConnectSOAP, ServiceREST, ServiceSOAP, ConnectKafka, ServiceKafka, ConnectMQ, ServiceMQ, ConnectJMS, ServiceJMS, ConnectFile, ServiceFile, ConnectFTP, ServiceFTP, ConnectHTTP, ServiceHTTP, ConnectCMIS, ConnectEJB, ServiceEJB |
| G07 | [group-07-async-events.json](./group-07-async-events.json) | Async & Event Listeners | 10 | QueueProcessor, JobScheduler, AgentQueue, FileListener, EmailListener, JMSListener, MQListener, KafkaListener, BackgroundJob, ScheduledTask |
| G08 | [group-08-security.json](./group-08-security.json) | Security & Access Control | 12 | AccessRoleName, AccessRoleObj, AccessWhen, AccessDeny, Privilege, AuthProfile, Authentication, OAuth2, SAML, ABAC, KMS, EncryptedProperty |
| G09 | [group-09-reports-analytics.json](./group-09-reports-analytics.json) | Reports & Analytics | 8 | ReportDefinition, ReportCategory, SummaryView, ListView, ReportShortcut, Chart, Dashboard, DataFlow |
| G10 | [group-10-parsing-mapping.json](./group-10-parsing-mapping.json) | Parsing & Mapping | 8 | ParseStructured, ParseDelimited, ParseXML, ParseJSON, MapXML, MapJSON, MapStructured, MapDelimited |
| G11 | [group-11-devops-deployment.json](./group-11-devops-deployment.json) | DevOps & Deployment | 8 | Product, ProductPatch, AppPackage, Pipeline, DeploymentManager, TestPipeline, Migration, RulesetVersionLock |
| G12 | [group-12-testing-qa.json](./group-12-testing-qa.json) | Testing & Quality Assurance | 6 | PegaUnit, TestSuite, TestFixture, MockService, TestAssertion, TestDataFactory |
| G13 | [group-13-mobile.json](./group-13-mobile.json) | Mobile & Offline | 5 | MobileApp, OfflineData, MobileBinary, PushNotification, MobileSkin |
| G14 | [group-14-system-application.json](./group-14-system-application.json) | System & Application | 9 | Application, RulesetName, RulesetVersion, Validate, EditValidate, SystemOption, SystemSetting, SystemLog, NodeSetting |

**Tổng Group Files: 166 rules** ✅

---

## Standalone Individual Files (17 files — dùng cho E2E tests)

| # | File | Loại Rule |
|---|---|---|
| S01 | [real-activity-export.json](./real-activity-export.json) | `Rule-Obj-Activity` |
| S02 | [real-datatransform-export.json](./real-datatransform-export.json) | `Rule-Obj-Model` |
| S03 | [real-decisiontable-export.json](./real-decisiontable-export.json) | `Rule-Declare-DecisionTable` |
| S04 | [real-datapage-export.json](./real-datapage-export.json) | `Rule-Declare-Pages` |
| S05 | [real-flow-export.json](./real-flow-export.json) | `Rule-Obj-Flow` |
| S06 | [real-connectrest-export.json](./real-connectrest-export.json) | `Rule-Connect-REST` |
| S07 | [real-declareexpression-export.json](./real-declareexpression-export.json) | `Rule-Declare-Expressions` |
| S08 | [real-when-export.json](./real-when-export.json) | `Rule-Obj-When` |
| S09 | [real-section-export.json](./real-section-export.json) | `Rule-HTML-Section` |
| S10 | [real-queueprocessor-export.json](./real-queueprocessor-export.json) | `Rule-Async-QueueProcessor` |
| S11 | [real-accessroleobj-export.json](./real-accessroleobj-export.json) | `Rule-Access-Role-Obj` |
| S12 | [real-reportdefinition-export.json](./real-reportdefinition-export.json) | `Rule-Obj-Report-Definition` |
| S13 | [real-servicerest-export.json](./real-servicerest-export.json) | `Rule-Service-REST` |
| S14 | [real-declaretrigger-export.json](./real-declaretrigger-export.json) | `Rule-Declare-Trigger` |
| S15 | [real-sla-export.json](./real-sla-export.json) | `Rule-Obj-SLA` |
| S16 | [real-validate-export.json](./real-validate-export.json) | `Rule-Obj-Validate` |
| S17 | [real-jobscheduler-export.json](./real-jobscheduler-export.json) | `Rule-Async-JobScheduler` |

---

## Ngữ Cảnh Ứng Dụng Mẫu

| Attribute | Value |
|---|---|
| **Application** | `PegaSampleLoan` |
| **Version** | `01-01-01` |
| **Work Class** | `PegaSample-CustomerLoan-Work-LoanApplication` |
| **Data Class** | `PegaSample-Data-Customer` |
| **Platform** | Pega PRPC 8.7 |
| **Domain** | Consumer Banking — Loan Processing |

> **Ghi chú**: Đây là bộ dữ liệu tổng hợp sát thực nhất với một ứng dụng Pega Enterprise thực tế.
> Dùng để kiểm thử hệ thống Pega Engine mà **không cần kết nối trực tiếp tới Pega Server**.

---

## Tài Liệu Kỹ Thuật

| File | Nội Dung |
|---|---|
| [PEGA-RULE-DEFINITION-API.md](./PEGA-RULE-DEFINITION-API.md) | Hướng dẫn lấy Rule Definition qua Java Activity (`tools.getDatabase().open()` + `getJSON()`), pzInsKey convention, JSON response structure, TypeScript interface mapping, dual-axis inheritance |
