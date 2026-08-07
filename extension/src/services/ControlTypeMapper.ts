/**
 * ControlTypeMapper — Maps Pega UI control types to JSON Schema types (SA4E-93).
 * Stateless, pure-function design. 13 known types + Unknown fallback (BR-03).
 */

import type {
  PegaControlType,
  ControlDefinition,
  JsonSchemaProperty,
  JsonSchemaTypeInfo,
} from "../models";

/** Lookup table: PegaControlType → JSON Schema type info */
const TYPE_MAP: Record<PegaControlType, JsonSchemaTypeInfo> = {
  TextInput: { type: "string" },
  TextArea: { type: "string" },
  NumberInput: { type: "number" },
  Checkbox: { type: "boolean" },
  Dropdown: { type: "string" },
  RadioButtons: { type: "string" },
  DatePicker: { type: "string", format: "date-time" },
  Autocomplete: { type: "string" },
  Link: { type: "string", format: "uri" },
  Integer: { type: "integer" },
  Hidden: { type: "string" },
  PageList: { type: "array", additionalProps: { items: { type: "object" } } },
  PageGroup: { type: "object", additionalProps: { additionalProperties: true } },
  Unknown: { type: "string" },
};

export class ControlTypeMapper {
  /**
   * Map a single control definition to a JSON Schema property.
   * @param control Control definition from HarnessSectionParser
   * @returns JSON Schema property definition
   */
  public mapControlToSchema(control: ControlDefinition): JsonSchemaProperty {
    const base = this.buildBaseProperty(control);
    this.applyConstraints(base, control);
    this.applyEnumValues(base, control);
    this.applyDefault(base, control);
    return base;
  }

  /**
   * Infer JSON Schema type string from Pega control type.
   * Unknown types fallback to "string" (BR-03).
   */
  public inferJsonType(controlType: PegaControlType): string {
    return TYPE_MAP[controlType]?.type ?? "string";
  }

  /** Build base property from type map lookup */
  private buildBaseProperty(control: ControlDefinition): JsonSchemaProperty {
    const info = TYPE_MAP[control.controlType] ?? TYPE_MAP.Unknown;
    const prop: JsonSchemaProperty = { type: info.type };
    if (info.format) { prop.format = info.format; }
    if (info.additionalProps) { Object.assign(prop, info.additionalProps); }
    if (control.label || control.tooltip) {
      prop.description = control.label || control.tooltip;
    }
    return prop;
  }

  /** Apply numeric/length constraints when present */
  private applyConstraints(prop: JsonSchemaProperty, ctrl: ControlDefinition): void {
    if (ctrl.maxLength !== undefined) { prop.maxLength = ctrl.maxLength; }
    if (ctrl.minimum !== undefined) { prop.minimum = ctrl.minimum; }
    if (ctrl.maximum !== undefined) { prop.maximum = ctrl.maximum; }
  }

  /** Apply enum values for Dropdown/RadioButtons */
  private applyEnumValues(prop: JsonSchemaProperty, ctrl: ControlDefinition): void {
    if (ctrl.validValues && ctrl.validValues.length > 0) {
      prop.enum = ctrl.validValues;
    }
  }

  /** Apply default value when provided */
  private applyDefault(prop: JsonSchemaProperty, ctrl: ControlDefinition): void {
    if (ctrl.defaultValue !== undefined) {
      prop.default = ctrl.controlType === "Checkbox"
        ? ctrl.defaultValue === "true"
        : ctrl.defaultValue;
    }
  }
}
