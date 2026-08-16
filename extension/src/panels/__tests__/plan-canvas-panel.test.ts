/**
 * Unit tests for Plan Canvas Panel — SA4E-132.
 * Tests: color mapping, HTML generation, missing STATUS.json handling, renderer output.
 */

import { describe, it, expect } from "vitest";
import {
  STATUS_COLORS,
  PHASE_ICONS,
  PHASE_DISPLAY_NAMES,
  PhaseStatus,
  PipelineStatus,
} from "../plan-canvas/plan-canvas-models";
import { renderCanvasBody } from "../plan-canvas/plan-canvas-renderer";
import { parseStatusFile } from "../plan-canvas/status-json-loader";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("PlanCanvasPanel — BR-801: Status Color Mapping", () => {
  it("maps done to green (#4CAF50)", () => {
    expect(STATUS_COLORS.done).toBe("#4CAF50");
  });

  it("maps in_progress to yellow/amber (#FFC107)", () => {
    expect(STATUS_COLORS.in_progress).toBe("#FFC107");
  });

  it("maps blocked to red (#F44336)", () => {
    expect(STATUS_COLORS.blocked).toBe("#F44336");
  });

  it("maps not_started to gray (#9E9E9E)", () => {
    expect(STATUS_COLORS.not_started).toBe("#9E9E9E");
  });

  it("maps needs_revision to orange (#FF9800)", () => {
    expect(STATUS_COLORS.needs_revision).toBe("#FF9800");
  });

  it("covers all PhaseStatus values", () => {
    const statuses: PhaseStatus[] = ["done", "in_progress", "blocked", "not_started", "needs_revision"];
    for (const s of statuses) {
      expect(STATUS_COLORS[s]).toBeDefined();
      expect(STATUS_COLORS[s]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe("PlanCanvasPanel — Phase Icons and Names", () => {
  it("has icons for all 12 phases", () => {
    const phases = [
      "requirements", "specification", "design", "security_design_review",
      "test_planning", "devops_pipeline_setup", "implementation",
      "security_code_review", "testing", "pentest",
      "security_deploy_review", "deployment",
    ];
    for (const p of phases) {
      expect(PHASE_ICONS[p]).toBeDefined();
      expect(PHASE_DISPLAY_NAMES[p]).toBeDefined();
    }
  });

  it("uses correct emoji for requirements", () => {
    expect(PHASE_ICONS.requirements).toBe("📋");
  });

  it("uses correct emoji for deployment", () => {
    expect(PHASE_ICONS.deployment).toBe("🚀");
  });
});

describe("PlanCanvasPanel — HTML Generation", () => {
  const mockPipeline: PipelineStatus = {
    ticket: "SA4E-132",
    currentPhase: "implementation",
    phases: {
      requirements: { status: "done", file: "BRD.md", completedAt: "2025-01-01" },
      specification: { status: "done", file: "FSD.md", completedAt: "2025-01-02" },
      design: { status: "done", file: "TDD.md", completedAt: "2025-01-03" },
      implementation: { status: "in_progress", startedAt: "2025-01-04" },
      testing: { status: "not_started" },
      deployment: { status: "blocked" },
    },
  };

  it("includes all phases from STATUS.json in HTML", () => {
    const html = renderCanvasBody([mockPipeline]);
    expect(html).toContain("Requirements");
    expect(html).toContain("Specification");
    expect(html).toContain("Design");
    expect(html).toContain("Implementation");
    expect(html).toContain("Testing");
    expect(html).toContain("Deployment");
  });

  it("includes ticket name in heading", () => {
    const html = renderCanvasBody([mockPipeline]);
    expect(html).toContain("SA4E-132");
    expect(html).toContain("Pipeline Status");
  });

  it("applies correct CSS class for each status", () => {
    const html = renderCanvasBody([mockPipeline]);
    expect(html).toContain('class="phase done"');
    expect(html).toContain('class="phase in_progress"');
    expect(html).toContain('class="phase not_started"');
    expect(html).toContain('class="phase blocked"');
  });

  it("applies correct border color from STATUS_COLORS", () => {
    const html = renderCanvasBody([mockPipeline]);
    expect(html).toContain(`border-color:${STATUS_COLORS.done}`);
    expect(html).toContain(`border-color:${STATUS_COLORS.in_progress}`);
    expect(html).toContain(`border-color:${STATUS_COLORS.blocked}`);
  });

  it("renders file info in detail table", () => {
    const html = renderCanvasBody([mockPipeline]);
    expect(html).toContain("BRD.md");
    expect(html).toContain("FSD.md");
    expect(html).toContain("TDD.md");
  });

  it("renders completion date in detail table", () => {
    const html = renderCanvasBody([mockPipeline]);
    expect(html).toContain("2025-01-01");
    expect(html).toContain("2025-01-02");
  });

  it("renders multiple pipelines", () => {
    const second: PipelineStatus = {
      ticket: "SA4E-100",
      currentPhase: "testing",
      phases: { requirements: { status: "done" }, testing: { status: "in_progress" } },
    };
    const html = renderCanvasBody([mockPipeline, second]);
    expect(html).toContain("SA4E-132");
    expect(html).toContain("SA4E-100");
  });
});

describe("PlanCanvasPanel — Missing STATUS.json", () => {
  it("shows 'No pipeline found' when no pipelines exist", () => {
    const html = renderCanvasBody([]);
    expect(html).toContain("No pipeline found");
    expect(html).toContain("No STATUS.json files found");
  });
});

describe("PlanCanvasPanel — parseStatusFile", () => {
  it("parses valid STATUS.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-canvas-test-"));
    const statusPath = path.join(tmpDir, "STATUS.json");
    const data = {
      ticket: "TEST-1",
      currentPhase: "design",
      phases: { requirements: { status: "done" }, design: { status: "in_progress" } },
      lastUpdated: "2025-07-01T00:00:00Z",
    };
    fs.writeFileSync(statusPath, JSON.stringify(data));

    const result = parseStatusFile(statusPath);
    expect(result).not.toBeNull();
    expect(result!.ticket).toBe("TEST-1");
    expect(result!.phases.requirements.status).toBe("done");

    // Cleanup
    fs.unlinkSync(statusPath);
    fs.rmdirSync(tmpDir);
  });

  it("returns null for invalid JSON", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-canvas-test-"));
    const statusPath = path.join(tmpDir, "STATUS.json");
    fs.writeFileSync(statusPath, "not valid json {{{");

    const result = parseStatusFile(statusPath);
    expect(result).toBeNull();

    fs.unlinkSync(statusPath);
    fs.rmdirSync(tmpDir);
  });

  it("returns null for missing ticket field", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-canvas-test-"));
    const statusPath = path.join(tmpDir, "STATUS.json");
    fs.writeFileSync(statusPath, JSON.stringify({ phases: {} }));

    const result = parseStatusFile(statusPath);
    expect(result).toBeNull();

    fs.unlinkSync(statusPath);
    fs.rmdirSync(tmpDir);
  });

  it("returns null for non-existent file", () => {
    const result = parseStatusFile("/non/existent/path/STATUS.json");
    expect(result).toBeNull();
  });
});

describe("PlanCanvasPanel — HTML XSS Safety", () => {
  it("escapes HTML special characters in ticket names", () => {
    const malicious: PipelineStatus = {
      ticket: "<script>alert('xss')</script>",
      currentPhase: "design",
      phases: { requirements: { status: "done" } },
    };
    const html = renderCanvasBody([malicious]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
