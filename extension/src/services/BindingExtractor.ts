/**
 * BindingExtractor — Extracts field bindings from Pega section/harness JSON (SA4E-95).
 * Multi-pattern extraction: pyValue, pyUsingPage, pyPropertyReference,
 * REPEAT/TABLE grids, data pages, pyFieldName, pyReferencePath.
 * Pure function module — no side effects, no I/O.
 */

import type { ControlDefinition, PegaControlType } from "../models";

/**
 * Extract ALL field bindings from a collection of harness + section JSONs.
 * Scans entire JSON tree recursively using 7 extraction patterns.
 */
export class BindingExtractor {
  /**
   * Deep-extract all field bindings from harness + fetched sections.
   * @param harnessJson Main harness JSON
   * @param sectionJsons Map of section name → section JSON
   * @returns Deduplicated array of control definitions
   */
  public extractAll(
    harnessJson: Record<string, unknown>,
    sectionJsons: Record<string, Record<string, unknown>>,
  ): ControlDefinition[] {
    const fields = new Map<string, ControlDefinition>();
    const allJsons = [harnessJson, ...Object.values(sectionJsons)];
    for (const json of allJsons) {
      this.scanForBindings(json, fields);
    }
    return Array.from(fields.values());
  }

  /**
   * Recursively scan JSON for ALL Pega field binding patterns.
   * Covers direct bindings, REPEAT/TABLE grids, page refs, data pages, control refs.
   */
  private scanForBindings(obj: unknown, fields: Map<string, ControlDefinition>): void {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { for (const item of obj) this.scanForBindings(item, fields); return; }
    const rec = obj as Record<string, unknown>;

    this.extractPyValue(rec, fields);
    this.extractPageReference(rec, fields);
    this.extractPropertyReference(rec, fields);
    this.extractRepeatGridBindings(rec, fields);
    this.extractDataPageBindings(rec, fields);
    this.extractDirectFieldName(rec, fields);
    this.extractReferencePath(rec, fields);

    for (const val of Object.values(rec)) { this.scanForBindings(val, fields); }
  }

  /** Pattern 1: pyValue starting with "." — direct field binding on editable controls */
  private extractPyValue(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const pyValue = rec.pyValue as string | undefined;
    if (!pyValue || typeof pyValue !== "string" || !pyValue.startsWith(".")) return;
    const fieldName = pyValue.substring(1);
    if (!fieldName || fields.has(fieldName)) return;
    const pyType = (rec.pyType as string) || "FIELD";
    fields.set(fieldName, {
      fieldName,
      controlType: this.mapPyTypeToControl(pyType),
      required: false,
      label: (rec.pyLabelPreview as string) || (rec.pyLabel as string) || undefined,
    });
  }

  /** Pattern 2: pyUsingPage — page object references (relationship to another class) */
  private extractPageReference(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const pyUsingPage = rec.pyUsingPage as string | undefined;
    if (!pyUsingPage || typeof pyUsingPage !== "string" || !pyUsingPage.trim()) return;
    const pageName = pyUsingPage.replace(/^\./, "");
    const key = `@page:${pageName}`;
    if (!pageName || fields.has(key)) return;
    fields.set(key, {
      fieldName: pageName,
      controlType: "PageList",
      required: false,
      label: `Page: ${pageName}`,
    });
  }

  /** Pattern 3: pyPropertyReference / pyPropertyName (dot-prefixed property refs) */
  private extractPropertyReference(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const propRef = (rec.pyPropertyReference || rec.pyPropertyName) as string | undefined;
    if (!propRef || typeof propRef !== "string" || !propRef.startsWith(".")) return;
    const fieldName = propRef.substring(1);
    if (!fieldName || fields.has(fieldName)) return;
    fields.set(fieldName, { fieldName, controlType: "TextInput", required: false });
  }

  /**
   * Pattern 4: REPEAT/TABLE grid bindings.
   * pyPageListProperty, pyGridProperty, pyRepeatProperty → page list fields.
   */
  private extractRepeatGridBindings(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    this.extractPageListProp(rec, fields);
    this.extractGridProp(rec, fields);
    this.extractRepeatProp(rec, fields);
  }

  /** Extract pyPageListProperty binding */
  private extractPageListProp(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const pageListProp = rec.pyPageListProperty as string | undefined;
    if (!pageListProp || typeof pageListProp !== "string") return;
    const propName = pageListProp.replace(/^\./, "");
    if (!propName || fields.has(propName)) return;
    const itemClass = (rec.pyPageListPropertyClass as string) || "";
    fields.set(propName, {
      fieldName: propName,
      controlType: "PageList",
      required: false,
      label: itemClass ? `Page list of ${itemClass}` : undefined,
    });
  }

  /** Extract pyGridProperty binding */
  private extractGridProp(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const gridProp = rec.pyGridProperty as string | undefined;
    if (!gridProp || typeof gridProp !== "string") return;
    const propName = gridProp.replace(/^\./, "");
    if (!propName || fields.has(propName)) return;
    const gridClass = (rec.pyGridClass as string) || "";
    fields.set(propName, {
      fieldName: propName,
      controlType: "PageList",
      required: false,
      label: gridClass ? `Grid of ${gridClass}` : undefined,
    });
  }

  /** Extract pyRepeatProperty binding */
  private extractRepeatProp(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const repeatProp = rec.pyRepeatProperty as string | undefined;
    if (!repeatProp || typeof repeatProp !== "string") return;
    const propName = repeatProp.replace(/^\./, "");
    if (!propName || fields.has(propName)) return;
    fields.set(propName, { fieldName: propName, controlType: "PageList", required: false });
  }

  /** Pattern 5: Data page references (pyDataPage, pyListSource, pyDataSource) */
  private extractDataPageBindings(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    // pyDataPage — data page binding
    const dataPage = rec.pyDataPage as string | undefined;
    if (dataPage && typeof dataPage === "string" && dataPage.trim()) {
      const pageName = dataPage.replace(/^\./, "");
      const key = `@datapage:${pageName}`;
      if (pageName && !fields.has(key)) {
        fields.set(key, {
          fieldName: pageName, controlType: "PageList", required: false,
          label: `Data page: ${pageName}`,
        });
      }
    }
    // pyListSource — dropdown/autocomplete list source (dot-prefixed)
    const listSource = rec.pyListSource as string | undefined;
    if (listSource && typeof listSource === "string" && listSource.startsWith(".")) {
      const fieldName = listSource.substring(1);
      if (fieldName && !fields.has(fieldName)) {
        fields.set(fieldName, {
          fieldName, controlType: "PageList", required: false,
          label: (rec.pyLabel as string) || undefined,
        });
      }
    }
    // pyDataSource — alternative data source reference
    const dataSource = rec.pyDataSource as string | undefined;
    if (dataSource && typeof dataSource === "string" && dataSource.startsWith(".")) {
      const fieldName = dataSource.substring(1);
      if (fieldName && !fields.has(fieldName)) {
        fields.set(fieldName, { fieldName, controlType: "PageList", required: false });
      }
    }
  }

  /** Pattern 6: pyFieldName without dot — only when node is a control */
  private extractDirectFieldName(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const fieldName = rec.pyFieldName as string | undefined;
    if (!fieldName || typeof fieldName !== "string" || fieldName.startsWith(".")) return;
    const isControl = rec.pyType || rec.pyControlType || rec.pyTemplateType || rec.pyFormat;
    if (!isControl || fields.has(fieldName)) return;
    const pyType = (rec.pyType as string) || "FIELD";
    fields.set(fieldName, {
      fieldName,
      controlType: this.mapPyTypeToControl(pyType),
      required: rec.pyMandatory === true || rec.pyMandatory === "true",
      label: (rec.pyLabel as string) || undefined,
    });
  }

  /** Pattern 7: pyReferencePath — dot-prefixed path references in advanced controls */
  private extractReferencePath(rec: Record<string, unknown>, fields: Map<string, ControlDefinition>): void {
    const refPath = rec.pyReferencePath as string | undefined;
    if (!refPath || typeof refPath !== "string" || !refPath.startsWith(".")) return;
    const fieldName = refPath.substring(1);
    if (!fieldName || fields.has(fieldName)) return;
    fields.set(fieldName, { fieldName, controlType: "TextInput", required: false });
  }

  /** Map Pega pyType to control type */
  private mapPyTypeToControl(pyType: string): PegaControlType {
    switch (pyType.toUpperCase()) {
      case "FIELD": return "TextInput";
      case "CHECKBOX": return "Checkbox";
      case "DROPDOWN": return "Dropdown";
      case "RADIOBUTTON": case "RADIO": return "RadioButtons";
      case "TEXTAREA": return "TextArea";
      case "DATETIME": case "DATE": return "DatePicker";
      case "LINK": return "Link";
      case "BUTTON": return "TextInput";
      default: return "TextInput";
    }
  }
}
