/**
 * SA4E-95 - FormatTypeMapper: configuration-driven pyFormat to JSON Schema type mapping.
 * Implements BR-02: Strategy pattern allows adding new formats without code changes.
 */

/** JSON Schema type definition produced by mapping */
export interface SchemaTypeDefinition {
  type: string;
  format?: string;
  readOnly?: boolean;
  'x-autocomplete'?: boolean;
  'x-widget'?: string;
  'x-unknown-format'?: string;
}

/**
 * Maps Pega pyFormat widget identifiers to JSON Schema type definitions.
 * Configuration-driven: new formats added to MAPPING table, no logic changes.
 */
export class FormatTypeMapper {
  /** BR-02: Complete pyFormat -> JSON Schema type mapping table */
  private static readonly MAPPING: Record<string, SchemaTypeDefinition> = {
    pxTextInput: { type: 'string' },
    pxTextArea: { type: 'string' },
    pxDropdown: { type: 'string' },
    pxCheckbox: { type: 'boolean' },
    pxDateTime: { type: 'string', format: 'date-time' },
    pxAutoComplete: { type: 'string', 'x-autocomplete': true },
    pxDisplayText: { type: 'string', readOnly: true },
    pxLink: { type: 'string', format: 'uri' },
    pxRadioButtons: { type: 'string' },
    pxIconAddItem: { type: 'string', 'x-widget': 'icon-add' },
    Default: { type: 'string' },
  };

  /**
   * Map a pyFormat value to its JSON Schema type definition.
   * Unknown formats default to string with x-unknown-format marker.
   * @param pyFormat - The Pega widget format identifier
   * @returns SchemaTypeDefinition for JSON Schema property
   */
  public map(pyFormat: string): SchemaTypeDefinition {
    return (
      FormatTypeMapper.MAPPING[pyFormat] ?? {
        type: 'string',
        'x-unknown-format': pyFormat,
      }
    );
  }

  /** Check if a pyFormat value has a known mapping */
  public isKnownFormat(pyFormat: string): boolean {
    return pyFormat in FormatTypeMapper.MAPPING;
  }

  /** Get all supported format identifiers */
  public getSupportedFormats(): string[] {
    return Object.keys(FormatTypeMapper.MAPPING);
  }
}
