/**
 * HarnessSectionParser — Extracts control definitions from raw harness JSON (SA4E-93).
 * Recursively walks pyHeaderSection/pyContentSection/pyFooterSection + pySections.
 * Pure function module — no side effects, no I/O.
 */

import type { ControlDefinition, PegaControlType } from "../models";

/** Known Pega control type identifiers mapped to our enum */
const CONTROL_TYPE_MAP: Record<string, PegaControlType> = {
  pxTextInput: "TextInput",
  pxTextArea: "TextArea",
  pxNumber: "NumberInput",
  pxCheckbox: "Checkbox",
  pxDropdown: "Dropdown",
  pxRadioButtons: "RadioButtons",
  pxDateTime: "DatePicker",
  pxAutoComplete: "Autocomplete",
  pxLink: "Link",
  pxInteger: "Integer",
  pxHidden: "Hidden",
  pxRepeatingDynamicLayout: "PageList",
  pxRepeatingGrid: "PageList",
  pxPageGroup: "PageGroup",
};

/** Top-level section keys in harness JSON */
const SECTION_KEYS = ["pyHeaderSection", "pyContentSection", "pyFooterSection"];

export class HarnessSectionParser {
  /**
   * Extract all UI controls from a raw harness JSON object.
   * Handles multiple Pega harness structures:
   * 1. pyHeaderSection/pyContentSection/pyFooterSection (design-time sections)
   * 2. pyLayouts / pxLayouts at top-level (actual rule JSON from Service 1)
   * @param harnessJson Full harness JSON from Pega
   * @returns Flat array of control definitions (deduplicated by fieldName)
   */
  public extractControls(harnessJson: Record<string, unknown>): ControlDefinition[] {
    const controls: ControlDefinition[] = [];
    // Path 1: Named section keys (pyHeaderSection, pyContentSection, pyFooterSection)
    for (const key of SECTION_KEYS) {
      const section = harnessJson[key];
      if (section) { controls.push(...this.parseSection(section)); }
    }
    // Path 2: Top-level pyLayouts (real harness JSON from Pega Service 1)
    if (Array.isArray(harnessJson.pyLayouts)) {
      for (const layout of harnessJson.pyLayouts) {
        controls.push(...this.parseSection(layout));
      }
    }
    // Path 3: Top-level pxLayouts (alternative key used in some Pega versions)
    if (Array.isArray(harnessJson.pxLayouts)) {
      for (const layout of harnessJson.pxLayouts) {
        controls.push(...this.parseSection(layout));
      }
    }
    // Path 4: Deep scan fallback for non-standard harness structures
    if (controls.length === 0) {
      controls.push(...this.deepScanForControls(harnessJson));
    }
    return this.deduplicateByFieldName(controls);
  }

  /** Recursively parse a section/layout for controls */
  private parseSection(section: unknown): ControlDefinition[] {
    if (!section || typeof section !== "object") { return []; }
    const sec = section as Record<string, unknown>;
    const controls: ControlDefinition[] = [];
    this.extractFromControls(sec, controls);
    this.extractFromProperties(sec, controls);
    this.extractFromNestedSections(sec, controls);
    return controls;
  }

  /** Extract controls from pyControls array */
  private extractFromControls(
    sec: Record<string, unknown>, out: ControlDefinition[],
  ): void {
    const pyControls = sec.pyControls;
    if (!Array.isArray(pyControls)) { return; }
    for (const ctrl of pyControls) {
      const def = this.mapRawControl(ctrl as Record<string, unknown>);
      if (def) { out.push(def); }
    }
  }

  /** Extract controls from direct properties (alternative structure) */
  private extractFromProperties(
    sec: Record<string, unknown>, out: ControlDefinition[],
  ): void {
    const fieldName = this.resolveFieldName(sec);
    if (fieldName) {
      const controlType = this.inferControlType(sec);
      out.push(this.buildControlDef(sec, fieldName, controlType));
    }
  }

  /** Recurse into nested pySections, pyLayouts, and pxLayouts */
  private extractFromNestedSections(
    sec: Record<string, unknown>, out: ControlDefinition[],
  ): void {
    const pySections = sec.pySections;
    if (Array.isArray(pySections)) {
      for (const nested of pySections) { out.push(...this.parseSection(nested)); }
    }
    const pyLayouts = sec.pyLayouts;
    if (Array.isArray(pyLayouts)) {
      for (const layout of pyLayouts) { out.push(...this.parseSection(layout)); }
    }
    // SA4E-93 fix: Also check pxLayouts (used in real Pega harness JSON)
    const pxLayouts = sec.pxLayouts;
    if (Array.isArray(pxLayouts)) {
      for (const layout of pxLayouts) { out.push(...this.parseSection(layout)); }
    }
  }

  /** Map raw control object to ControlDefinition */
  private mapRawControl(ctrl: Record<string, unknown>): ControlDefinition | null {
    const fieldName = this.resolveFieldName(ctrl);
    if (!fieldName) { return null; }
    const controlType = this.inferControlType(ctrl);
    return this.buildControlDef(ctrl, fieldName, controlType);
  }

  /** Build a ControlDefinition from raw properties */
  private buildControlDef(
    props: Record<string, unknown>, fieldName: string, controlType: PegaControlType,
  ): ControlDefinition {
    return {
      fieldName,
      controlType,
      required: props.pyMandatory === true || props.pyMandatory === "true",
      label: (props.pyLabel as string) || undefined,
      tooltip: (props.pyTooltip as string) || undefined,
      defaultValue: (props.pyDefaultValue as string) || undefined,
      validValues: Array.isArray(props.pyValidValues) ? props.pyValidValues : undefined,
      maxLength: typeof props.pyMaxLength === "number" ? props.pyMaxLength : undefined,
      minimum: typeof props.pyMinimum === "number" ? props.pyMinimum : undefined,
      maximum: typeof props.pyMaximum === "number" ? props.pyMaximum : undefined,
    };
  }

  /** Resolve field name from various raw property keys */
  private resolveFieldName(props: Record<string, unknown>): string | undefined {
    return (props.pyFieldName as string)
      || (props.pyPropertyName as string)
      || undefined;
  }

  /** Infer PegaControlType from raw property indicators */
  private inferControlType(props: Record<string, unknown>): PegaControlType {
    const rawType = (props.pyControlType as string)
      || (props.pyTemplateType as string)
      || "";
    // Direct match by pyControlType value
    for (const [key, value] of Object.entries(CONTROL_TYPE_MAP)) {
      if (rawType === key || rawType === value) { return value; }
    }
    // Heuristic: check property mode indicators
    if (props.pyPropertyMode === "PageList") { return "PageList"; }
    if (props.pyPropertyMode === "PageGroup") { return "PageGroup"; }
    return "Unknown";
  }

  /**
   * Deep scan fallback: walk all object/array values recursively to find controls.
   * SA4E-95: Multi-pattern extraction — pyValue, pyPageListProperty, pyGridProperty,
   * pyListSource, pyDataPage, pyReferencePath, pyFieldName on controls.
   */
  private deepScanForControls(obj: Record<string, unknown>): ControlDefinition[] {
    const controls: ControlDefinition[] = [];
    const scan = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { for (const item of node) scan(item); return; }
      const rec = node as Record<string, unknown>;

      // Pattern 1: pyValue starting with "." (direct field binding on editable controls)
      if (rec.pyValue && typeof rec.pyValue === "string" && (rec.pyValue as string).startsWith(".")) {
        const fieldName = (rec.pyValue as string).substring(1);
        if (fieldName) {
          const pyFormat = (rec.pyFormat as string) || "Default";
          const pyType = (rec.pyType as string) || "FIELD";
          const controlType = (rec.pxObjClass === "Embed-Display-Table-Cell")
            ? this.mapPyFormatToControlType(pyFormat)
            : this.inferControlTypeFromPyType(pyType);
          controls.push({
            fieldName,
            controlType,
            required: false,
            label: (rec.pyLabelPreview as string) || (rec.pyLabel as string) || undefined,
          });
        }
      }

      // Pattern 2: pyPageListProperty (REPEAT layout = PageList)
      if (rec.pyPageListProperty && typeof rec.pyPageListProperty === "string") {
        const propName = (rec.pyPageListProperty as string).replace(/^\./, "");
        const itemClass = (rec.pyPageListPropertyClass as string) || "";
        if (propName) {
          controls.push({
            fieldName: propName,
            controlType: "PageList",
            required: false,
            label: itemClass ? `Page list of ${itemClass}` : undefined,
          });
        }
      }

      // Pattern 3: pyGridProperty (Grid table page list binding)
      if (rec.pyGridProperty && typeof rec.pyGridProperty === "string") {
        const propName = (rec.pyGridProperty as string).replace(/^\./, "");
        if (propName) {
          const gridClass = (rec.pyGridClass as string) || "";
          controls.push({
            fieldName: propName,
            controlType: "PageList",
            required: false,
            label: gridClass ? `Grid of ${gridClass}` : undefined,
          });
        }
      }

      // Pattern 4: pyListSource (dropdown/autocomplete list source, dot-prefixed)
      if (rec.pyListSource && typeof rec.pyListSource === "string" && (rec.pyListSource as string).startsWith(".")) {
        const fieldName = (rec.pyListSource as string).substring(1);
        if (fieldName) {
          controls.push({
            fieldName,
            controlType: "PageList",
            required: false,
            label: (rec.pyLabel as string) || undefined,
          });
        }
      }

      // Pattern 5: pyDataPage (data page reference)
      if (rec.pyDataPage && typeof rec.pyDataPage === "string" && (rec.pyDataPage as string).trim()) {
        const pageName = (rec.pyDataPage as string).replace(/^\./, "");
        if (pageName) {
          controls.push({
            fieldName: pageName,
            controlType: "PageList",
            required: false,
            label: `Data page: ${pageName}`,
          });
        }
      }

      // Pattern 6: pyReferencePath (dot-prefixed path in advanced controls)
      if (rec.pyReferencePath && typeof rec.pyReferencePath === "string" && (rec.pyReferencePath as string).startsWith(".")) {
        const fieldName = (rec.pyReferencePath as string).substring(1);
        if (fieldName) {
          controls.push({ fieldName, controlType: "TextInput", required: false });
        }
      }

      // Pattern 7: pyFieldName on controls (without dot, must have control context)
      if (rec.pyFieldName && typeof rec.pyFieldName === "string" && !(rec.pyFieldName as string).startsWith(".")) {
        const isControl = rec.pyType || rec.pyControlType || rec.pyTemplateType || rec.pyFormat;
        if (isControl) {
          controls.push({
            fieldName: rec.pyFieldName as string,
            controlType: this.inferControlTypeFromPyType((rec.pyType as string) || "FIELD"),
            required: rec.pyMandatory === true || rec.pyMandatory === "true",
            label: (rec.pyLabel as string) || undefined,
          });
        }
      }

      // Recurse into all values
      for (const val of Object.values(rec)) { scan(val); }
    };
    scan(obj);
    return controls;
  }

  /** SA4E-95: Map pyFormat to PegaControlType */
  private mapPyFormatToControlType(pyFormat: string): PegaControlType {
    return CONTROL_TYPE_MAP[pyFormat] || "Unknown";
  }

  /** SA4E-95: Map pyType string to PegaControlType */
  private inferControlTypeFromPyType(pyType: string): PegaControlType {
    switch (pyType.toUpperCase()) {
      case "FIELD": return "TextInput";
      case "CHECKBOX": return "Checkbox";
      case "DROPDOWN": return "Dropdown";
      case "RADIOBUTTON": case "RADIO": return "RadioButtons";
      case "TEXTAREA": return "TextArea";
      case "DATETIME": case "DATE": return "DatePicker";
      case "LINK": return "Link";
      default: return "Unknown";
    }
  }

  /** Remove duplicate controls keeping first occurrence per fieldName */
  private deduplicateByFieldName(controls: ControlDefinition[]): ControlDefinition[] {
    const seen = new Set<string>();
    return controls.filter((c) => {
      if (seen.has(c.fieldName)) { return false; }
      seen.add(c.fieldName);
      return true;
    });
  }
}
