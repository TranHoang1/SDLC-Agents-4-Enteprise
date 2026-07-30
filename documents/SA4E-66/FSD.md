# Functional Specification Document (FSD) — SA4E-66: Pega Rule Type Coverage — 7 Parser Modules

**Title**: Expand Parser Coverage from ~15% to ~70% Rule Types (Explicit Parsers) + 100% Effective through DefaultPegaParserStrategy Fallback
**Ticket Key**: SA4E-66
**Author**: BA + TA Agent
**Status**: APPROVED
**Date**: 2026-07-27

---

## 1. Executive Summary & Core Architectural Principle

### 1.1 Core Principle: Strategy-Based Parse Resolution
The SDLC-Agents-4-Enterprise platform resolves rule type parsing through a central `PegaParserRegistry` that maps `pxObjClass` patterns to `IPegaRuleParserStrategy` implementations via `supports()`. When raw rule JSON arrives from the Pega Bridge services, the registry selects the appropriate parser. If no explicit parser matches, the `DefaultPegaParserStrategy` provides a generic parse result. This guarantees 100% coverage with zero parsing gaps.

- **PegaParserRegistry.ts**: Central dispatcher — `registry.parse(json) => ParseResult`.
- **6 Parser Modules**: Connect, Declare, Access, Portal, Decisioning, Misc.
- **DefaultPegaParserStrategy Fallback**: Catches all unregistered rule types with generic parse result.

---

## 2. Diagram Index & Visual Architecture

| Diagram ID | Title | Description | File Path |
| :--- | :--- | :--- | :--- |
| `fsd-parser-flow` | Parser Resolution Flow | Runtime flow from raw rule JSON to typed AST via registry | [fsd_parser_flow.png](./diagrams/fsd_parser_flow.png) |
| `fsd-module-map` | Module Dependency Map | Inter-module dependencies and shared types | [fsd_module_map.png](./diagrams/fsd_module_map.png) |
| `fsd-contract` | Parser Strategy Contract | IPegaRuleParserStrategy interface contract | [fsd_parser_contract.png](./diagrams/fsd_parser_contract.png) |

### 2.1 Parser Resolution Flow
![Parser Resolution Flow](./diagrams/fsd_parser_flow.png)

### 2.2 Module Dependency Map
![Module Dependency Map](./diagrams/fsd_module_map.png)

### 2.3 Parser Strategy Contract
![Parser Strategy Contract](./diagrams/fsd_parser_contract.png)

---

## 3. Endpoints & Interface Specifications

### Interface: `IPegaRuleParserStrategy`
```typescript
interface IPegaRuleParserStrategy {
  supports(pxObjClass: string): boolean;
  parse(json: Record<string, unknown>): ParseResult;
}
```

### Registry Resolution
```
Input: pxObjClass = "Rule-Connect-REST"
  → PegaConnectParser.supports("Rule-Connect-REST") → true
  → PegaConnectParser.parse(rawJson) → ParseResult

Input: pxObjClass = "Rule-Declare-Expression"
  → PegaDeclareParser.supports("Rule-Declare-Expression") → true
  → PegaDeclareParser.parse(rawJson) → ParseResult

Input: pxObjClass = "Rule-Obj-CaseType"
  → PegaMiscParser.supports("Rule-Obj-CaseType") → true
  → PegaMiscParser.parse(rawJson) → ParseResult

Input: pxObjClass = "Rule-Unknown-Type"
  → No explicit parser matches
  → DefaultPegaParserStrategy.parse(rawJson) → ParseResult
```

---

## 4. Parser Module Specifications

### Module 1: Connect Parser
- **Target Classes**: `Rule-Connect-*`, `Rule-Service-*`
- **Strategies**: REST, SOAP, SQL, File, HTTP, MQ, JMS, JCA, Java, EJB, dotNet, CMIS
- **Parsed Fields**:
  - `pyEndpointURL`, `pyAuthenticationProfile`, `pyRequestTransform`, `pyResponseTransform`
  - `pyHTTPMethod`, `pyHeaders`, `pyQueryParams`, `pyBodyTemplate`
  - `pyConnectionTimeout`, `pyReadTimeout`, `pyMaxConnections`
  - `pySOAPAction`, `pyWSDLURL`, `pyNamespace`
  - `pySQLStatement`, `pyDataSource`, `pyConnectionString`
- **Output AST Type**: `PegaConnectRule`
- **Tests**: 20

### Module 2: Declare Parser
- **Target Classes**: `Rule-Declare-*`
- **Strategies**: Expression, OnChange, Trigger, Pages, Constraints, Index, DecisionTable, DecisionTree
- **Parsed Fields**:
  - `pyExpression`, `pyCondition`, `pyWhenRule`
  - `pyPages`, `pyPageName`, `pyPageClass`
  - `pyConstraintMessage`, `pyConstraintExpression`
  - `pyIndexProperties`, `pyIndexType`
  - `pyDecisionTableRows`, `pyDecisionTreeNodes`
- **Output AST Type**: `PegaDeclareRule`
- **Tests**: 30

### Module 3: Access Parser
- **Target Classes**: `Rule-Access-*`, `Rule-Admin-*`, `Data-Admin-*`
- **Strategies**: AccessGroup, AccessRole, Privilege, OperatorID, OrgDivision, OrgUnit, SecurityVA
- **Parsed Fields**:
  - `pyAccessGroupName`, `pyAccessRoles`, `pyPrivileges`
  - `pyOperatorID`, `pyOrganization`, `pyOrgUnit`
  - `pySecurityVA`, `pyAllowedActions`, `pyDeniedActions`
  - `pyRoleHierarchy`, `pyInheritedRoles`
- **Output AST Type**: `PegaAccessRule`
- **Tests**: 33

### Module 4: Portal Parser
- **Target Classes**: `Rule-HTML-*`, `Rule-Portal`, `Rule-Navigation`
- **Strategies**: Section, Harness, FlowAction, Portal, Skin, Navigation
- **Parsed Fields**:
  - `pyLayout`, `pyLayoutType`, `pyColumns`, `pyFields`
  - `pyHarnessName`, `pyHeaderSection`, `pyContentSection`, `pyFooterSection`
  - `pyFlowActionName`, `pyButtonLabel`, `pyConfirmMessage`
  - `pyPortalName`, `pyTabs`, `pyDefaultLanding`
  - `pySkinName`, `pyCSSProperties`, `pyTheme`
  - `pyNavigationMenu`, `pyMenuItems`
- **Output AST Type**: `PegaPortalRule`
- **Tests**: 23

### Module 5: Decisioning Parser
- **Target Classes**: `Rule-Decision-*`, `Rule-Strategy-*`
- **Strategies**: Strategy, NBA, Offer, Proposition, Treatment
- **Parsed Fields**:
  - `pyStrategyName`, `pyStrategyType`, `pyComponents`
  - `pyNBAName`, `pyEligibility`, `pyRanking`, `pyIssue`, `pyGroup`
  - `pyOfferName`, `pyOfferText`, `pyStartDate`, `pyEndDate`
  - `pyPropositionName`, `pyFilter`, `pyWeight`
  - `pyTreatmentName`, `pyContent`, `pyTreatmentType`
- **Output AST Type**: `PegaDecisioningRule`
- **Tests**: 37

### Module 6: Misc Parser
- **Target Classes**: 15+ catch-all rule types
- **Strategies**: MapValue, FieldValue, CaseType, Stage, ServiceLevel, Circumstance, Agent, ReportDef, Correspondence, File, EditValidate, AutoTest, Utility, Message, Stream, Shortcut
- **Parsed Fields** (type-specific extraction):
  - `pyMapRule`, `pyValueMap`, `pySourceField`, `pyTargetField`
  - `pyCaseTypeName`, `pyStages`, `pyStartShape`
  - `pyServiceLevelName`, `pyGoal`, `pyDeadline`, `pyUrgency`
  - `pyCircumstanceName`, `pyProperty`, `pyValue`
  - `pyAgentName`, `pySchedule`, `pyQuery`
  - `pyReportName`, `pyDataSource`, `pyColumns`
  - `pyCorrespondenceName`, `pyTemplate`, `pyFormat`
  - `pyFileName`, `pyFileType`, `pyContent`
  - `pyEditFunction`, `pyValidateRule`
  - `pyTestName`, `pyTestSteps`
  - `pyUtilityName`, `pyActivity`
  - `pyMessageName`, `pyMessageText`
  - `pyStreamName`, `pyStreamType`
  - `pyShortcutName`, `pyTarget`
- **Output AST Type**: `MapValue`, `FieldValue`, `CaseType`, `Stage`, `ServiceLevel`, `Circumstance`, etc.
- **Tests**: 29
