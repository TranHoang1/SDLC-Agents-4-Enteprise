/**
 * Unit tests for DataTableKeyComputer — pure functions for key computation (SA4E-172).
 */
import { describe, it, expect } from "vitest";
import { computeDataTableKey, computeDatabaseKey, isCriticalError } from "../services/DataTableKeyComputer";
import type { ClassRuleInput } from "../models/DataTableModels";

describe("computeDataTableKey", () => {
  it("returns key for ISCLASSGROUP concrete class", () => {
    const rule: ClassRuleInput = {
      pzInsKey: "RULE-OBJ-CLASS TGB-HRAPPS-WORK",
      pyClassName: "TGB-HRApps-Work",
      pyClassType: "Concrete",
      pyClassGroupIndicator: "ISCLASSGROUP",
    };
    expect(computeDataTableKey(rule)).toBe("DATA-ADMIN-DB-TABLE TGB-HRAPPS-WORK");
  });

  it("returns key using pyClassGroup for HASCLASSGROUP", () => {
    const rule: ClassRuleInput = {
      pzInsKey: "RULE-OBJ-CLASS TGB-HRAPPS-WORK-ONBOARDING",
      pyClassName: "TGB-HRApps-Work-Onboarding",
      pyClassType: "Concrete",
      pyClassGroupIndicator: "HASCLASSGROUP",
      pyClassGroup: "TGB-HRApps-Work",
    };
    expect(computeDataTableKey(rule)).toBe("DATA-ADMIN-DB-TABLE TGB-HRAPPS-WORK");
  });

  it("returns key for NOCLASSGROUP concrete class", () => {
    const rule: ClassRuleInput = {
      pzInsKey: "RULE-OBJ-CLASS TGB-UTIL",
      pyClassName: "TGB-Util",
      pyClassType: "Concrete",
      pyClassGroupIndicator: "NOCLASSGROUP",
    };
    expect(computeDataTableKey(rule)).toBe("DATA-ADMIN-DB-TABLE TGB-UTIL");
  });

  it("returns null for abstract classes (BR-03)", () => {
    const rule: ClassRuleInput = {
      pzInsKey: "RULE-OBJ-CLASS TGB-HRAPPS-DATA",
      pyClassName: "TGB-HRApps-Data",
      pyClassType: "Abstract",
      pyClassGroupIndicator: "ISCLASSGROUP",
    };
    expect(computeDataTableKey(rule)).toBeNull();
  });

  it("returns null for unknown indicator", () => {
    const rule: ClassRuleInput = {
      pzInsKey: "RULE-OBJ-CLASS X",
      pyClassName: "X",
      pyClassType: "Concrete",
      pyClassGroupIndicator: "UNKNOWN_VALUE",
    };
    expect(computeDataTableKey(rule)).toBeNull();
  });

  it("returns null for HASCLASSGROUP with empty pyClassGroup", () => {
    const rule: ClassRuleInput = {
      pzInsKey: "RULE-OBJ-CLASS Y",
      pyClassName: "Y",
      pyClassType: "Concrete",
      pyClassGroupIndicator: "HASCLASSGROUP",
      pyClassGroup: undefined,
    };
    expect(computeDataTableKey(rule)).toBeNull();
  });
});

describe("computeDatabaseKey", () => {
  it("returns key for valid pyDatabaseName (BR-02)", () => {
    expect(computeDatabaseKey("PegaDATA")).toBe("DATA-ADMIN-DB-NAME PEGADATA");
  });

  it("returns null for empty string", () => {
    expect(computeDatabaseKey("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(computeDatabaseKey("   ")).toBeNull();
  });

  it("uppercases the database name", () => {
    expect(computeDatabaseKey("myCustomDb")).toBe("DATA-ADMIN-DB-NAME MYCUSTOMDB");
  });
});

describe("isCriticalError", () => {
  it("returns true for 401", () => {
    expect(isCriticalError(new Error("HTTP 401 Unauthorized"))).toBe(true);
  });

  it("returns true for 500", () => {
    expect(isCriticalError(new Error("HTTP 500 Internal Server Error"))).toBe(true);
  });

  it("returns false for 404", () => {
    expect(isCriticalError(new Error("HTTP 404 Not Found"))).toBe(false);
  });

  it("returns false for generic error", () => {
    expect(isCriticalError(new Error("Network timeout"))).toBe(false);
  });
});
