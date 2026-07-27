import { PegaLayoutRenderer } from './PegaLayoutRenderer.js';
import type { PegaLayout } from '../PegaUITypes.js';
import type { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaFieldRenderer } from '../PegaFieldRenderer.js';

export class PegaDynamicLayoutRenderer extends PegaLayoutRenderer {
  render(
    layout: PegaLayout,
    context: PegaClipboardContext,
    fieldRenderer: PegaFieldRenderer,
    renderSubLayout: (l: PegaLayout, ctx: PegaClipboardContext, fr: PegaFieldRenderer) => string,
  ): string {
    const rawCount = layout.properties?.columnCount;
    const columnCount = typeof rawCount === 'number' ? rawCount : 1;
    const children = layout.children ?? [];
    const fields = layout.fields ?? [];

    const items: string[] = [];

    for (const child of children) {
      if (child.type && child.type !== 'dynamic') {
        items.push(renderSubLayout(child, context, fieldRenderer));
      } else if (child.fields && child.fields.length > 0) {
        for (const field of child.fields) {
          items.push(fieldRenderer.renderField(field, context));
        }
      } else {
        items.push(renderSubLayout(child, context, fieldRenderer));
      }
    }

    for (const field of fields) {
      items.push(fieldRenderer.renderField(field, context));
    }

    const width = columnCount > 1 ? `calc(${100 / columnCount}% - 8px)` : '100%';
    const wrapped = items.map(i => `<div style="width:${width}">${i}</div>`).join('');

    return `<div class="pega-dynamic-layout" style="display:flex;flex-wrap:wrap;gap:8px;">${wrapped}</div>`;
  }
}