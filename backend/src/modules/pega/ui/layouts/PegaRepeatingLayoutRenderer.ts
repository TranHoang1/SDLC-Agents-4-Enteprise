import { PegaLayoutRenderer } from './PegaLayoutRenderer.js';
import type { PegaLayout } from '../PegaUITypes.js';
import type { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaFieldRenderer } from '../PegaFieldRenderer.js';

export class PegaRepeatingLayoutRenderer extends PegaLayoutRenderer {
  render(
    layout: PegaLayout,
    context: PegaClipboardContext,
    fieldRenderer: PegaFieldRenderer,
    renderSubLayout: (l: PegaLayout, ctx: PegaClipboardContext, fr: PegaFieldRenderer) => string,
  ): string {
    const columns = layout.children ?? [];
    const fields = layout.fields ?? [];

    let headerCells = columns.map(c => {
      const label = (c.properties?.label as string) ?? (c.fields?.[0]?.name ?? 'Value');
      return `<th>${label}</th>`;
    }).join('');

    for (const f of fields) {
      const label = f.label ?? f.name;
      headerCells += `<th>${label}</th>`;
    }

    let rowCells = columns.map(c => {
      if (c.type && c.type !== 'repeating') {
        return `<td>${renderSubLayout(c, context, fieldRenderer)}</td>`;
      }
      const cellFields = c.fields ?? [];
      return `<td>${cellFields.map(f => fieldRenderer.renderField(f, context)).join('')}</td>`;
    }).join('');

    for (const f of fields) {
      rowCells += `<td>${fieldRenderer.renderField(f, context)}</td>`;
    }

    const header = columns.length > 0 || fields.length > 0
      ? `<thead><tr>${headerCells}</tr></thead>`
      : '';

    return `<table class="pega-repeating">${header}<tbody><tr>${rowCells}</tr></tbody></table>`;
  }
}