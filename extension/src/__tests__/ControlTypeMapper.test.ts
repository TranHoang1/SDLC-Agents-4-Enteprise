/**
 * Unit Tests for ControlTypeMapper (SA4E-93).
 * Covers TC-UT-01 to TC-UT-04: type mapping correctness.
 */

import { describe, it, expect } from "vitest";
import { ControlTypeMapper } from "../services/ControlTypeMapper";
import type { ControlDefinition, PegaControlType } from "../models";

function makeControl(overrides: Partial<ControlDefinition>): ControlDefinition {
  return {
    fieldName: "pyField",
    controlType: "TextInput",
    required: false,
    ...overrides,
  };
}

describe("ControlTypeMapper", () => {
  const mapper = new ControlTypeMapper();

  describe("TC-UT-01: TextInput maps to string", () => {
    it("should return type string with maxLength", () => {
      const ctrl = makeControl({
        fieldName: "pyName",
        controlType: "TextInput",
        required: true,
        maxLength: 100,
      });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("string");
      expect(result.maxLength).toBe(100);
    });

    it("should return type string without constraints when none given", () => {
      const ctrl = makeControl({ controlType: "TextInput" });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("string");
      expect(result.maxLength).toBeUndefined();
    });
  });

  describe("TC-UT-02: Checkbox maps to boolean", () => {
    it("should return type boolean with default false", () => {
      const ctrl = makeControl({
        fieldName: "pyEnabled",
        controlType: "Checkbox",
        required: true,
        defaultValue: "false",
      });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("boolean");
      expect(result.default).toBe(false);
    });

    it("should return type boolean with default true", () => {
      const ctrl = makeControl({
        controlType: "Checkbox",
        defaultValue: "true",
      });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("boolean");
      expect(result.default).toBe(true);
    });
  });

  describe("TC-UT-03: Dropdown maps to string with enum", () => {
    it("should return type string with enum values", () => {
      const ctrl = makeControl({
        fieldName: "pyStatus",
        controlType: "Dropdown",
        validValues: ["Active", "Inactive", "Pending"],
      });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("string");
      expect(result.enum).toEqual(["Active", "Inactive", "Pending"]);
    });

    it("should return type string without enum if validValues empty", () => {
      const ctrl = makeControl({
        controlType: "Dropdown",
        validValues: [],
      });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("string");
      expect(result.enum).toBeUndefined();
    });
  });

  describe("TC-UT-04: Unknown fallback to string", () => {
    it("should return type string for unknown control type", () => {
      const ctrl = makeControl({
        fieldName: "pyCustom",
        controlType: "Unknown" as PegaControlType,
      });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("string");
    });

    it("inferJsonType returns string for Unknown", () => {
      expect(mapper.inferJsonType("Unknown")).toBe("string");
    });
  });

  describe("Additional type coverage", () => {
    it("TextArea maps to string", () => {
      const result = mapper.mapControlToSchema(makeControl({ controlType: "TextArea" }));
      expect(result.type).toBe("string");
    });

    it("NumberInput maps to number", () => {
      const ctrl = makeControl({ controlType: "NumberInput", minimum: 0, maximum: 100 });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("number");
      expect(result.minimum).toBe(0);
      expect(result.maximum).toBe(100);
    });

    it("DatePicker maps to string with format date-time", () => {
      const result = mapper.mapControlToSchema(makeControl({ controlType: "DatePicker" }));
      expect(result.type).toBe("string");
      expect(result.format).toBe("date-time");
    });

    it("Link maps to string with format uri", () => {
      const result = mapper.mapControlToSchema(makeControl({ controlType: "Link" }));
      expect(result.type).toBe("string");
      expect(result.format).toBe("uri");
    });

    it("Integer maps to integer", () => {
      const result = mapper.mapControlToSchema(makeControl({ controlType: "Integer" }));
      expect(result.type).toBe("integer");
    });

    it("PageList maps to array with object items", () => {
      const result = mapper.mapControlToSchema(makeControl({ controlType: "PageList" }));
      expect(result.type).toBe("array");
      expect(result.items).toEqual({ type: "object" });
    });

    it("PageGroup maps to object with additionalProperties", () => {
      const result = mapper.mapControlToSchema(makeControl({ controlType: "PageGroup" }));
      expect(result.type).toBe("object");
      expect(result.additionalProperties).toBe(true);
    });

    it("RadioButtons maps to string with enum", () => {
      const ctrl = makeControl({
        controlType: "RadioButtons",
        validValues: ["Yes", "No"],
      });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.type).toBe("string");
      expect(result.enum).toEqual(["Yes", "No"]);
    });

    it("includes description from label", () => {
      const ctrl = makeControl({ label: "Full Name" });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.description).toBe("Full Name");
    });

    it("includes description from tooltip when no label", () => {
      const ctrl = makeControl({ tooltip: "Enter your name" });
      const result = mapper.mapControlToSchema(ctrl);
      expect(result.description).toBe("Enter your name");
    });
  });
});
