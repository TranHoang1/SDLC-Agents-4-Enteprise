/**
 * SA4E-95 - SchemaBuilder transforms ParsedHarness IR into JSON Schema Draft 2020-12.
 * Implements UC-07, BR-02, BR-10, BR-12, BR-18.
 */
import type { ParsedHarness } from '../models/ParsedHarness.js';
import type { ParsedSection } from '../models/ParsedSection.js';
import type { ExtractedField } from '../models/ExtractedField.js';
import type { TemplateMarker } from '../models/TemplateMarker.js';
import type { FormatTypeMapper } from './FormatTypeMapper.js';

/** JSON Schema Draft 2020-12 structure */
export interface JSONSchema2020 {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  type: string;
  properties: Record<string, unknown>;
  required: string[];
  $defs: Record<string, unknown>;
  'x-generation-metadata': Record<string, unknown>;
}

/**
 * Builds JSON Schema from ParsedHarness intermediate representation.
 * Uses FormatTypeMapper strategy for pyFormat -> type conversion.
 */
export class SchemaBuilder {
  constructor(private readonly formatMapper: FormatTypeMapper) {}

  /**
   * Build a complete JSON Schema from a parsed harness.
   * @param harness - Parsed harness IR from HarnessParser
   * @returns Valid JSON Schema Draft 2020-12 object
   */
  build(harness: ParsedHarness): JSONSchema2020 {
    const schema: JSONSchema2020 = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `pega://schemas/${harness.ruleType}.schema.json`,
      title: harness.ruleType,
      description: 'Auto-generated schema from RuleForm harness parsing',
      type: 'object',
      properties: {},
      required: [],
      $defs: {},
      'x-generation-metadata': this.buildMetadata(harness),
    };

    this.processSections(harness.sections, schema);
    this.addTemplateMarkers(schema, harness.templateMarkers);
    return schema;
  }

  /** Calculate coverage metric (BR-18) */
  calculateCoverage(harness: ParsedHarness): number {
    const totalFields = this.countAllFields(harness.sections);
    const templateSkipped = harness.templateMarkers.length;
    if (totalFields + templateSkipped === 0) return 0;
    return (totalFields / (totalFields + templateSkipped)) * 100;
  }

  /** Process all sections recursively, adding properties to schema */
  private processSections(
    sections: ParsedSection[],
    schema: JSONSchema2020
  ): void {
    for (const section of sections) {
      this.processSection(section, schema);
    }
  }

  /** Process a single section: fields, repeats, and children */
  private processSection(
    section: ParsedSection,
    schema: JSONSchema2020
  ): void {
    // Add fields as properties
    for (const field of section.fields) {
      this.addFieldProperty(field, schema);
    }

    // Handle repeat layouts as array properties
    if (section.repeatProperty) {
      this.addRepeatProperty(section, schema);
    }

    // Recurse into children
    for (const child of section.children) {
      this.processSection(child, schema);
    }
  }

  /** Map a field to a JSON Schema property (BR-02, BR-12) */
  private addFieldProperty(
    field: ExtractedField,
    schema: JSONSchema2020
  ): void {
    const typeInfo = this.formatMapper.map(field.pyFormat);
    const property: Record<string, unknown> = { ...typeInfo };

    // BR-12: readOnly flag
    if (field.readOnly) {
      property.readOnly = true;
    }

    if (field.label) {
      property.description = field.label;
    }

    schema.properties[field.propertyName] = property;

    // Add to required array if field is mandatory
    if (field.required && !schema.required.includes(field.propertyName)) {
      schema.required.push(field.propertyName);
    }
  }

  /** Add repeat layout as array property with items $ref */
  private addRepeatProperty(
    section: ParsedSection,
    schema: JSONSchema2020
  ): void {
    const repeat = section.repeatProperty!;
    const defName = repeat.itemClass || `${repeat.propertyName}Item`;

    // Build items definition from repeat fields
    const itemDef: Record<string, unknown> = {
      type: 'object',
      properties: {},
    };

    for (const field of repeat.fields) {
      const typeInfo = this.formatMapper.map(field.pyFormat);
      const prop: Record<string, unknown> = { ...typeInfo };
      if (field.readOnly) prop.readOnly = true;
      if (field.label) prop.description = field.label;
      (itemDef.properties as Record<string, unknown>)[field.propertyName] = prop;
    }

    // Register in $defs and reference
    schema.$defs[defName] = itemDef;
    schema.properties[repeat.propertyName] = {
      type: 'array',
      items: { $ref: `#/$defs/${defName}` },
      'x-source-section': section.name,
      'x-page-list-class': repeat.itemClass,
    };
  }

  /** Add template markers as x-template-layout extensions (BR-10) */
  private addTemplateMarkers(
    schema: JSONSchema2020,
    markers: TemplateMarker[]
  ): void {
    for (const marker of markers) {
      const key = `x-template-${marker.sectionName}`;
      schema.properties[key] = {
        'x-template-layout': true,
        description: `Skipped: ${marker.reason}`,
      };
    }
  }

  /** Build x-generation-metadata object */
  private buildMetadata(harness: ParsedHarness): Record<string, unknown> {
    return {
      generatedAt: new Date().toISOString(),
      harnessInsKey: harness.metadata.insKey,
      coverage: this.calculateCoverage(harness),
      templateSections: harness.templateMarkers.map((m) => m.sectionName),
    };
  }

  /** Count all extracted fields recursively across sections */
  private countAllFields(sections: ParsedSection[]): number {
    let count = 0;
    for (const section of sections) {
      count += section.fields.length;
      if (section.repeatProperty) {
        count += section.repeatProperty.fields.length;
      }
      count += this.countAllFields(section.children);
    }
    return count;
  }
}
