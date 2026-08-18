import type { PegaSection } from './PegaUITypes.js';
import type { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import { PegaSectionRenderer } from './PegaSectionRenderer.js';

export interface HarnessSections {
  header?: PegaSection;
  content?: PegaSection;
  footer?: PegaSection;
}

export class PegaHarnessAssembler {
  private sectionRenderer = new PegaSectionRenderer();

  assemble(sections: HarnessSections, context: PegaClipboardContext): string {
    const headerHtml = sections.header
      ? `<header class="pega-header">${this.sectionRenderer.renderSection(sections.header, context)}</header>`
      : '';

    const contentHtml = sections.content
      ? `<main class="pega-content">${this.sectionRenderer.renderSection(sections.content, context)}</main>`
      : '';

    const footerHtml = sections.footer
      ? `<footer class="pega-footer">${this.sectionRenderer.renderSection(sections.footer, context)}</footer>`
      : '';

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Pega Harness Preview</title><style>${this.getCssStyles()}</style></head><body>${headerHtml}${contentHtml}${footerHtml}</body></html>`;
  }

  private getCssStyles(): string {
    return '.pega-header{background:#f5f5f5;padding:12px 16px;border-bottom:1px solid #ddd;margin-bottom:8px}.pega-content{padding:16px;min-height:300px}.pega-footer{background:#f5f5f5;padding:8px 16px;border-top:1px solid #ddd;margin-top:8px;font-size:0.9em;color:#666}.pega-section{margin-bottom:16px}.pega-dynamic-layout{background:#fff;border:1px solid #e0e0e0;border-radius:4px;padding:8px;margin-bottom:8px}.pega-tab-layout{border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;margin-bottom:8px}.pega-tabs{display:flex;background:#fafafa;border-bottom:1px solid #e0e0e0}.pega-tab{padding:8px 16px;border:none;background:transparent;cursor:pointer;font-size:0.9em;color:#333}.pega-tab.active{background:#fff;border-bottom:2px solid #1976d2;color:#1976d2;font-weight:600}.pega-tab-panel{display:none;padding:12px}.pega-tab-panel.active{display:block}.pega-repeating{width:100%;border-collapse:collapse;margin-bottom:8px}.pega-repeating th,.pega-repeating td{border:1px solid #e0e0e0;padding:6px 10px;text-align:left;font-size:0.9em}.pega-repeating th{background:#fafafa;font-weight:600}.pega-table{width:100%;border-collapse:collapse;margin-bottom:8px}.pega-table th,.pega-table td{border:1px solid #e0e0e0;padding:6px 10px;text-align:left;font-size:0.9em}.pega-table th{background:#fafafa;font-weight:600}.pega-field{margin-bottom:8px;padding:4px 0}.pega-field-label{display:block;font-size:0.8em;color:#666;margin-bottom:2px;font-weight:500}.pega-field-value{font-size:0.95em;color:#333;padding:4px 8px;background:#f9f9f9;border-radius:3px;border:1px solid #eee;min-height:1.4em}';
  }
}