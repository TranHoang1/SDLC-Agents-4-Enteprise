/**
 * Unit Tests for HarnessSectionParser (SA4E-93).
 * Covers TC-UT-05 to TC-UT-09: recursive extraction, dedup, empty handling.
 */

import { describe, it, expect } from "vitest";
import { HarnessSectionParser } from "../services/HarnessSectionParser";

describe("HarnessSectionParser", () => {
  const parser = new HarnessSectionParser();

  describe("TC-UT-05: Single section with 3 controls", () => {
    it("should extract 3 ControlDefinitions from pyControls array", () => {
      const harnessJson = {
        pyContentSection: {
          pyControls: [
            { pyFieldName: "pyFirstName", pyControlType: "pxTextInput", pyLabel: "First Name" },
            { pyFieldName: "pyEnabled", pyControlType: "pxCheckbox", pyMandatory: true },
            { pyFieldName: "pyStatus", pyControlType: "pxDropdown", pyValidValues: ["A", "B"] },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toHaveLength(3);
      expect(result[0].fieldName).toBe("pyFirstName");
      expect(result[0].controlType).toBe("TextInput");
      expect(result[1].fieldName).toBe("pyEnabled");
      expect(result[1].controlType).toBe("Checkbox");
      expect(result[1].required).toBe(true);
      expect(result[2].fieldName).toBe("pyStatus");
      expect(result[2].controlType).toBe("Dropdown");
    });
  });

  describe("TC-UT-06: Nested sections (2 levels)", () => {
    it("should flatten controls from nested pySections", () => {
      const harnessJson = {
        pyContentSection: {
          pyControls: [
            { pyFieldName: "pyTopLevel1", pyControlType: "pxTextInput" },
            { pyFieldName: "pyTopLevel2", pyControlType: "pxNumber" },
          ],
          pySections: [
            {
              pyControls: [
                { pyFieldName: "pyNested1", pyControlType: "pxCheckbox" },
                { pyFieldName: "pyNested2", pyControlType: "pxTextArea" },
                { pyFieldName: "pyNested3", pyControlType: "pxDateTime" },
              ],
            },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toHaveLength(5);
      const fieldNames = result.map(c => c.fieldName);
      expect(fieldNames).toContain("pyTopLevel1");
      expect(fieldNames).toContain("pyTopLevel2");
      expect(fieldNames).toContain("pyNested1");
      expect(fieldNames).toContain("pyNested2");
      expect(fieldNames).toContain("pyNested3");
    });

    it("should flatten controls from deeply nested pyLayouts", () => {
      const harnessJson = {
        pyContentSection: {
          pyLayouts: [
            {
              pyControls: [
                { pyFieldName: "pyLayoutField", pyControlType: "pxTextInput" },
              ],
              pyLayouts: [
                {
                  pyControls: [
                    { pyFieldName: "pyDeepField", pyControlType: "pxInteger" },
                  ],
                },
              ],
            },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      const fieldNames = result.map(c => c.fieldName);
      expect(fieldNames).toContain("pyLayoutField");
      expect(fieldNames).toContain("pyDeepField");
    });
  });

  describe("TC-UT-07: Empty section (no controls)", () => {
    it("should return empty array for empty pyControls", () => {
      const harnessJson = {
        pyContentSection: {
          pyControls: [],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toEqual([]);
    });

    it("should return empty array for section with no pyControls key", () => {
      const harnessJson = {
        pyContentSection: {
          someOtherProp: "value",
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toEqual([]);
    });

    it("should return empty array for completely empty harness JSON", () => {
      const result = parser.extractControls({});
      expect(result).toEqual([]);
    });

    it("should handle non-object section gracefully", () => {
      const harnessJson = {
        pyContentSection: "not-an-object",
      };
      const result = parser.extractControls(harnessJson as any);
      expect(result).toEqual([]);
    });
  });

  describe("TC-UT-08: Deduplication by fieldName", () => {
    it("should keep only first occurrence of duplicate fieldName", () => {
      const harnessJson = {
        pyContentSection: {
          pyControls: [
            { pyFieldName: "pyClassName", pyControlType: "pxTextInput", pyLabel: "First" },
            { pyFieldName: "pyClassName", pyControlType: "pxDropdown", pyLabel: "Second" },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe("pyClassName");
      expect(result[0].controlType).toBe("TextInput");
    });

    it("should deduplicate across different sections", () => {
      const harnessJson = {
        pyHeaderSection: {
          pyControls: [
            { pyFieldName: "pyShared", pyControlType: "pxTextInput" },
          ],
        },
        pyContentSection: {
          pyControls: [
            { pyFieldName: "pyShared", pyControlType: "pxDropdown" },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toHaveLength(1);
      expect(result[0].controlType).toBe("TextInput");
    });
  });

  describe("TC-UT-09: Header + Content + Footer extraction", () => {
    it("should extract controls from all 3 sections", () => {
      const harnessJson = {
        pyHeaderSection: {
          pyControls: [
            { pyFieldName: "pyHeaderField", pyControlType: "pxTextInput" },
          ],
        },
        pyContentSection: {
          pyControls: [
            { pyFieldName: "pyContentField1", pyControlType: "pxCheckbox" },
            { pyFieldName: "pyContentField2", pyControlType: "pxNumber" },
          ],
        },
        pyFooterSection: {
          pyControls: [
            { pyFieldName: "pyFooterField", pyControlType: "pxLink" },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toHaveLength(4);
      const fieldNames = result.map(c => c.fieldName);
      expect(fieldNames).toContain("pyHeaderField");
      expect(fieldNames).toContain("pyContentField1");
      expect(fieldNames).toContain("pyContentField2");
      expect(fieldNames).toContain("pyFooterField");
    });
  });

  describe("Edge cases", () => {
    it("should resolve fieldName from pyPropertyName if pyFieldName missing", () => {
      const harnessJson = {
        pyContentSection: {
          pyControls: [
            { pyPropertyName: "pyAlternateField", pyControlType: "pxTextInput" },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe("pyAlternateField");
    });

    it("should skip controls without any fieldName", () => {
      const harnessJson = {
        pyContentSection: {
          pyControls: [
            { pyControlType: "pxTextInput" },
            { pyFieldName: "pyValid", pyControlType: "pxTextInput" },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe("pyValid");
    });

    it("should handle pyLayouts at top-level harness", () => {
      const harnessJson = {
        pyLayouts: [
          {
            pyControls: [
              { pyFieldName: "pyLayoutTopField", pyControlType: "pxTextInput" },
            ],
          },
        ],
      };
      const result = parser.extractControls(harnessJson);
      expect(result.some(c => c.fieldName === "pyLayoutTopField")).toBe(true);
    });

    it("should extract property metadata (label, tooltip, defaultValue)", () => {
      const harnessJson = {
        pyContentSection: {
          pyControls: [
            {
              pyFieldName: "pyAmount",
              pyControlType: "pxNumber",
              pyLabel: "Amount",
              pyTooltip: "Enter amount",
              pyDefaultValue: "0",
              pyMaxLength: 10,
              pyMinimum: 0,
              pyMaximum: 1000,
            },
          ],
        },
      };
      const result = parser.extractControls(harnessJson);
      expect(result[0].label).toBe("Amount");
      expect(result[0].tooltip).toBe("Enter amount");
      expect(result[0].defaultValue).toBe("0");
      expect(result[0].maxLength).toBe(10);
      expect(result[0].minimum).toBe(0);
      expect(result[0].maximum).toBe(1000);
    });
  });
});
