/**
 * PlanCanvasRenderer — Generates HTML for the Plan Canvas webview.
 * SA4E-132: Isolated rendering logic (SRP), testable without vscode dependency.
 */

import {
  PipelineStatus, PhaseStatus,
  STATUS_COLORS, PHASE_ICONS, PHASE_DISPLAY_NAMES,
} from "./plan-canvas-models";

/** Render the full HTML body for one or more pipeline status entries. */
export function renderCanvasBody(pipelines: PipelineStatus[]): string {
  if (pipelines.length === 0) {
    return `<div class="plan-canvas empty"><h2>No pipeline found</h2>
      <p>No STATUS.json files found in documents/*/STATUS.json</p></div>`;
  }
  return pipelines.map(renderPipeline).join("\n");
}

/** Render a single pipeline ticket status. */
function renderPipeline(pipeline: PipelineStatus): string {
  const phases = Object.entries(pipeline.phases);
  return `<div class="plan-canvas">
  <h2>${escapeHtml(pipeline.ticket)} — Pipeline Status</h2>
  <div class="phases-bar">${phases.map(([k, v]) => renderPhaseChip(k, v.status)).join("")}</div>
  <div class="phases-detail"><table>
    <tr><th>Phase</th><th>Status</th><th>File</th><th>Updated</th></tr>
    ${phases.map(([k, v]) => renderPhaseRow(k, v.status, v.file, v.completedAt)).join("")}
  </table></div>
</div>`;
}

/** Render a single phase chip in the progress bar. */
function renderPhaseChip(phase: string, status: PhaseStatus): string {
  const icon = PHASE_ICONS[phase] || "❓";
  const name = PHASE_DISPLAY_NAMES[phase] || phase;
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started;
  return `<div class="phase ${status}" style="border-color:${color}" title="${name}: ${status}">
    <div class="phase-icon">${icon}</div>
    <div class="phase-name">${escapeHtml(name)}</div>
  </div>`;
}

/** Render a detail table row for a phase. */
function renderPhaseRow(phase: string, status: PhaseStatus, file?: string, completedAt?: string): string {
  const icon = PHASE_ICONS[phase] || "❓";
  const name = PHASE_DISPLAY_NAMES[phase] || phase;
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started;
  const badge = `<span class="badge" style="background:${color}">${status}</span>`;
  return `<tr>
    <td>${icon} ${escapeHtml(name)}</td>
    <td>${badge}</td>
    <td>${file ? escapeHtml(file) : "—"}</td>
    <td>${completedAt ? escapeHtml(completedAt) : "—"}</td>
  </tr>`;
}

/** Inline CSS for the Plan Canvas panel. */
export function getCanvasCss(): string {
  return `
    body { font-family: var(--vscode-font-family, sans-serif); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    .plan-canvas { margin-bottom: 32px; }
    .plan-canvas.empty { text-align: center; margin-top: 60px; opacity: 0.7; }
    h2 { margin: 0 0 16px 0; font-size: 1.3em; }
    .phases-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .phase { display: flex; flex-direction: column; align-items: center; padding: 8px 12px; border-radius: 8px; border: 2px solid; min-width: 72px; text-align: center; background: var(--vscode-editor-background); }
    .phase-icon { font-size: 1.5em; margin-bottom: 4px; }
    .phase-name { font-size: 0.7em; white-space: nowrap; }
    .phase.done { opacity: 1; }
    .phase.in_progress { animation: pulse 2s infinite; }
    .phase.not_started { opacity: 0.5; }
    .phase.blocked { opacity: 1; }
    .phase.needs_revision { opacity: 0.9; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
    table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
    th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--vscode-widget-border, #333); }
    th { font-weight: 600; opacity: 0.8; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75em; color: #fff; }
    #refresh-btn { position: fixed; top: 12px; right: 16px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; }
    #refresh-btn:hover { background: var(--vscode-button-hoverBackground); }
  `;
}

/** Escape HTML special characters. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
