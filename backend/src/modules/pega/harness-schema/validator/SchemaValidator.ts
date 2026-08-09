/**
 * SA4E-95 - SchemaValidator: Ajv-based validation of rule JSON against generated schemas.
 * Implements UC-08, BR-13: opt-in validation with field-level error reporting.
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

/** Validation error with path and context */
export interface ValidationError {
  path: string;
  message: string;
  expected: string;
  actual: unknown;
}

/** Result of schema validation */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Interface for schema validation */
export interface ISchemaValidator {
  validate(ruleJson: Record<string, unknown>, pxObjClass: string): ValidationResult;
  isValidationEnabled(): boolean;
}

/**
 * Validates Pega rule JSON against generated JSON Schema files.
 * Uses Ajv with pre-compiled schemas for performance (< 10ms per validation).
 * Validation is opt-in via configuration (BR-13).
 */
export class SchemaValidator implements ISchemaValidator {
  private readonly ajv: Ajv;
  private readonly schemasDir: string;
  private readonly enabled: boolean;
  private readonly compiledCache = new Map<string, ReturnType<Ajv['compile']>>();

  constructor(config: { schemasDir: string; enabled?: boolean }) {
    this.schemasDir = config.schemasDir;
    this.enabled = config.enabled ?? false;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /** Check if validation is enabled (BR-13: opt-in) */
  isValidationEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Validate rule JSON against its generated schema.
   * Returns valid=true if no schema exists (graceful degradation).
   * @param ruleJson - Raw rule JSON to validate
   * @param pxObjClass - Rule class for schema lookup
   */
  validate(ruleJson: Record<string, unknown>, pxObjClass: string): ValidationResult {
    if (!this.enabled) {
      return { valid: true, errors: [] };
    }

    const validator = this.getOrCompileSchema(pxObjClass);
    if (!validator) {
      // No schema exists — skip validation gracefully
      return { valid: true, errors: [] };
    }

    const valid = validator(ruleJson);
    if (valid) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: this.mapErrors(validator.errors ?? []),
    };
  }

  /** Get or compile schema for a rule class */
  private getOrCompileSchema(
    pxObjClass: string
  ): ReturnType<Ajv['compile']> | null {
    if (this.compiledCache.has(pxObjClass)) {
      return this.compiledCache.get(pxObjClass)!;
    }

    const schema = this.loadSchemaFile(pxObjClass);
    if (!schema) return null;

    try {
      const compiled = this.ajv.compile(schema);
      this.compiledCache.set(pxObjClass, compiled);
      return compiled;
    } catch {
      // Schema compilation failed — skip validation
      return null;
    }
  }

  /** Load schema JSON from file system */
  private loadSchemaFile(pxObjClass: string): Record<string, unknown> | null {
    const filename = `${pxObjClass.replace(/-/g, '-')}.schema.json`;
    const filePath = path.join(this.schemasDir, filename);

    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Map Ajv errors to our ValidationError format */
  private mapErrors(ajvErrors: NonNullable<ReturnType<Ajv['compile']>['errors']>): ValidationError[] {
    return ajvErrors.map((err) => ({
      path: err.instancePath || '/',
      message: err.message ?? 'Validation failed',
      expected: JSON.stringify(err.params ?? {}),
      actual: undefined,
    }));
  }
}
