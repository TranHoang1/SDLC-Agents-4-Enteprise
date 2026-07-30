import { PegaLayoutRenderer } from './PegaLayoutRenderer.js';
import type { PegaLayout } from '../PegaUITypes.js';
import type { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaFieldRenderer } from '../PegaFieldRenderer.js';

export class PegaTableLayoutRenderer extends PegaLayoutRenderer {
  render(
    layout: PegaLayout,
    context: PegaClipboardContext,
    fieldRenderer: PegaFieldRenderer,
    renderSubLayout: (l: PegaLayout, ctx: PegaClipboardContext, fr: PegaFieldRenderer) => string,
  ): string {
    const fields = layout.fields ?? [];
    const children = layout.children ?? [];

    const headerCells = fields.map(f => {
      const label = f.label ?? f.name;
      return `<th>${label}</th>`;
    }).join('');

    const dataCells = fields.map(f => {
      return `<td>${fieldRenderer.renderField(f, context)}</td>`;
    }).join('');

    const childRows = children.map(c => {
      return `<tr><td colspan="${Math.max(1, fields.length)}">${renderSubLayout(c, context, fieldRenderer)}</td></tr>`;
    }).join('');

    const thead = fields.length > 0 ? `<thead><tr>${headerCells}</tr></thead>` : '';

    return `<table class="pega-table">${thead}<tbody><tr>${dataCells}</tr>${childRows}</tbody></table>`;
  }
}