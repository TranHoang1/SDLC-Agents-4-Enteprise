import { PegaLayoutRenderer } from './PegaLayoutRenderer.js';
import type { PegaLayout } from '../PegaUITypes.js';
import type { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaFieldRenderer } from '../PegaFieldRenderer.js';

export class PegaTabLayoutRenderer extends PegaLayoutRenderer {
  render(
    layout: PegaLayout,
    context: PegaClipboardContext,
    fieldRenderer: PegaFieldRenderer,
    renderSubLayout: (l: PegaLayout, ctx: PegaClipboardContext, fr: PegaFieldRenderer) => string,
  ): string {
    const children = layout.children ?? [];
    const tabButtons: string[] = [];
    const tabPanels: string[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const label = (child.properties?.label as string) ?? `Tab ${i + 1}`;
      const activeClass = i === 0 ? ' active' : '';
      const content = renderSubLayout(child, context, fieldRenderer);

      tabButtons.push(`<button class="pega-tab${activeClass}">${label}</button>`);
      tabPanels.push(`<div class="pega-tab-panel${activeClass}">${content}</div>`);
    }

    const tabs = `<div class="pega-tabs">${tabButtons.join('')}</div>`;
    const panels = `<div class="pega-tab-panels">${tabPanels.join('')}</div>`;

    return `<div class="pega-tab-layout">${tabs}${panels}</div>`;
  }
}