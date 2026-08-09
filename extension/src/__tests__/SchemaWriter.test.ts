/**
 * Unit Tests for SchemaWriter (SA4E-93).
 * Covers TC-UT-14, TC-UT-15: filename sanitization.
 */

import { describe, it, expect } from "vitest";
import { SchemaWriter } from "../services/SchemaWriter";

describe("SchemaWriter", () => {
  const writer = new SchemaWriter();

  describe("TC-UT-14: sanitizeFileName preserves casing", () => {
    it("should preserve casing and keep hyphens", () => {
      const result = writer.sanitizeFileName("Rule-Obj-Activity");
      expect(result).toBe("Rule-Obj-Activity");
    });

    it("should preserve mixed case", () => {
      const result = writer.sanitizeFileName("MyCustomClass");
      expect(result).toBe("MyCustomClass");
    });

    it("should keep dots and underscores", () => {
      const result = writer.sanitizeFileName("Rule_With.Dots");
      expect(result).toBe("Rule_With.Dots");
    });

    it("should keep numbers", () => {
      const result = writer.sanitizeFileName("Rule-V2-01");
      expect(result).toBe("Rule-V2-01");
    });
  });

  describe("TC-UT-15: sanitizeFileName replaces invalid chars", () => {
    it("should replace slashes with hyphens", () => {
      const result = writer.sanitizeFileName("Rule/With\\Special:Chars");
      expect(result).toBe("Rule-With-Special-Chars");
    });

    it("should replace asterisks and question marks", () => {
      const result = writer.sanitizeFileName("Rule*Here?Now");
      expect(result).toBe("Rule-Here-Now");
    });

    it("should collapse consecutive replaced chars into single hyphen", () => {
      const result = writer.sanitizeFileName("Rule///Multi");
      expect(result).toBe("Rule-Multi");
    });

    it("should replace angle brackets and pipes", () => {
      const result = writer.sanitizeFileName("Rule<With>Pipes|Here");
      expect(result).toBe("Rule-With-Pipes-Here");
    });

    it("should replace spaces", () => {
      const result = writer.sanitizeFileName("Rule With Spaces");
      expect(result).toBe("Rule-With-Spaces");
    });

    it("should handle complex mixed invalid chars", () => {
      // "Work-/" → "Work-" + "-" → "Work--" → collapsed to "Work-"
      const result = writer.sanitizeFileName("Work-/Obj\\Class:Name*Here");
      expect(result).toBe("Work-Obj-Class-Name-Here");
    });
  });

  describe("getOutputDirectory", () => {
    it("should return correct path", () => {
      const result = writer.getOutputDirectory("/workspace");
      expect(result).toContain("schemas");
      expect(result).toContain("auto");
    });
  });
});
