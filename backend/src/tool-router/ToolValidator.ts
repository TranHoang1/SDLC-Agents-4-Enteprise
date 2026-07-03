/**
 * ToolValidator — validates tool call arguments against their schemas using zod.
 */

import { z } from 'zod';
import type { ToolDefinition } from '../types/tool.js';

export class ToolValidator {
  /**
   * Validate arguments against a tool's inputSchema.
   * Returns null if valid, or error message string if invalid.
   */
  validate(tool: ToolDefinition, args: Record<string, unknown>): string | null {
    const schema = tool.inputSchema;
    if (!schema || typeof schema !== 'object') return null;

    const properties = (schema as Record<string, unknown>).properties as Record<string, unknown> | undefined;
    const required = (schema as Record<string, unknown>).required as string[] | undefined;

    // Check required fields
    if (required && Array.isArray(required)) {
      for (const field of required) {
        if (args[field] === undefined || args[field] === null) {
          return `Missing required field: ${field}`;
        }
      }
    }

    // Basic type checks for defined properties
    if (properties) {
      for (const [key, spec] of Object.entries(properties)) {
        if (args[key] === undefined) continue;
        const propSpec = spec as Record<string, unknown>;
        const expectedType = propSpec.type as string | undefined;

        if (expectedType && !this.checkType(args[key], expectedType)) {
          return `Invalid type for field '${key}': expected ${expectedType}, got ${typeof args[key]}`;
        }
      }
    }

    return null;
  }

  private checkType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'object': return typeof value === 'object' && value !== null;
      case 'array': return Array.isArray(value);
      default: return true;
    }
  }
}
