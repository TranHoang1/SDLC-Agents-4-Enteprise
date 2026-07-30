# TASK — Work Package 4: Section/Harness UI Preview

## 1. Summary

Generate HTML previews from Pega UI section and harness rules. Map Pega layout types (Dynamic, Tab, Repeating, Column, Table) to CSS grid/flexbox HTML structures. Resolve field references to property names/types. Apply visibility conditions via WP1 expression evaluator. Output is static HTML with inline CSS — no JavaScript runtime.

Reference: [Upgrade Plan §6](../SA4E-56/pega-parser-upgrade-plan.md#6-work-package-4-sectionharness-ui-preview)

## 2. Scope

### 2.1 Layout Types Covered

| Pega Layout Type | Renderer | HTML Output |
|-----------------|----------|-------------|
| **Dynamic Layout** | `PegaDynamicLayoutRenderer` | CSS Grid/Flexbox container with configurable column count |
| **Tab Layout** | `PegaTabLayoutRenderer` | Tabbed panel: tab header list + tab content sections |
| **Repeating Layout** | `PegaRepeatingLayoutRenderer` | HTML table with row template; each row = one iteration |
| **Column Layout** | Included in Dynamic layout | Multi-column CSS grid (`pega-columns-N`) |
| **Table Layout** | `PegaTableLayoutRenderer` | Static HTML table with labeled columns |

### 2.2 Field Rendering
- Each field: `<label>` + `<div class="pega-field-value">` with property name and type
- Property type shown: `(Text)`, `(Decimal)`, `(Boolean)`, `(DateTime)`, `(Page)`, `(PageList)`
- Field label from `pyLabel` property or fallback to property name

### 2.3 Harness Assembly
- Header section → `<header class="pega-header">`
- Content section → `<main class="pega-content">`
- Footer section → `<footer class="pega-footer">`
- Full HTML document with `<style>` block for all `.pega-*` CSS classes

### 2.4 Visibility Conditions
- Evaluate `pyVisible` / `pyWhen` conditions on fields and sections
- If condition evaluates to false → element rendered with `display: none` or omitted
- Condition evaluation delegated to WP1 `PegaExpressionEvaluator`

## 3. Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **PegaSectionRenderer** | `backend/src/modules/pega/ui/PegaSectionRenderer.ts` | Main orchestrator: takes section AST, delegates to layout renderers, returns HTML |
| **PegaLayoutRenderer** | `backend/src/modules/pega/ui/layouts/PegaLayoutRenderer.ts` | Abstract base for layout renderers |
| **PegaDynamicLayoutRenderer** | `backend/src/modules/pega/ui/layouts/PegaDynamicLayoutRenderer.ts` | Dynamic Layout → CSS flexbox/grid |
| **PegaTabLayoutRenderer** | `backend/src/modules/pega/ui/layouts/PegaTabLayoutRenderer.ts` | Tab Layout → tabbed HTML with section panels |
| **PegaRepeatingLayoutRenderer** | `backend/src/modules/pega/ui/layouts/PegaRepeatingLayoutRenderer.ts` | Repeating Layout → HTML table |
| **PegaTableLayoutRenderer** | `backend/src/modules/pega/ui/layouts/PegaTableLayoutRenderer.ts` | Table Layout → static HTML table |
| **PegaFieldRenderer** | `backend/src/modules/pega/ui/PegaFieldRenderer.ts` | Render individual field → label + value HTML |
| **PegaHarnessAssembler** | `backend/src/modules/pega/ui/PegaHarnessAssembler.ts` | Assemble header + content + footer → full harness HTML |
| **PegaVisibilityEvaluator** | `backend/src/modules/pega/ui/PegaVisibilityEvaluator.ts` | Evaluate show/when conditions on fields/sections |

## 4. Effort: 7 person-weeks

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Layout type catalog + rendering framework | 1 | Sample UI section JSON exports |
| Dynamic + Column layout renderers | 1.5 | Framework |
| Field renderer + property metadata integration | 1 | Dynamic layout renderer |
| Tab layout renderer | 1 | Framework |
| Repeating + Table layout renderers | 1 | Field renderer |
| Harness assembler (header/content/footer) | 1 | All layout renderers |
| Visibility condition evaluator | 0.5 | WP1 expression evaluator |

## 5. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| WP1 — Expression Language Parser | Moderate | Visibility conditions need expression evaluation |
| WP1 — Clipboard context model | Moderate | Field property type resolution |
| Sample UI Section JSON exports | External | Real sections with various layout types |

## 6. Out of Scope
- Pixel-perfect Pega UI rendering (structural preview only)
- JavaScript interactive runtime (static HTML only)
- CSS framework integration (inline CSS only)
- Portal/dashboard rendering (sections only)
- Accessibility (ARIA labels, keyboard navigation)