import type { PegaSection, PegaLayout, PegaField } from './PegaUITypes.js';
import type { LayoutType } from './PegaUITypes.js';
import type { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import { PegaLayoutRenderer } from './layouts/PegaLayoutRenderer.js';
import { PegaDynamicLayoutRenderer } from './layouts/PegaDynamicLayoutRenderer.js';
import { PegaTabLayoutRenderer } from './layouts/PegaTabLayoutRenderer.js';
import { PegaRepeatingLayoutRenderer } from './layouts/PegaRepeatingLayoutRenderer.js';
import { PegaTableLayoutRenderer } from './layouts/PegaTableLayoutRenderer.js';
import { PegaFieldRenderer } from './PegaFieldRenderer.js';
import { PegaVisibilityEvaluator } from './PegaVisibilityEvaluator.js';

export class PegaSectionRenderer {
  private renderers = new Map<LayoutType, PegaLayoutRenderer>();
  private fieldRenderer = new PegaFieldRenderer();
  private visibilityEvaluator = new PegaVisibilityEvaluator();

  constructor() {
    this.renderers.set('dynamic', new PegaDynamicLayoutRenderer());
    this.renderers.set('tab', new PegaTabLayoutRenderer());
    this.renderers.set('repeating', new PegaRepeatingLayoutRenderer());
    this.renderers.set('table', new PegaTableLayoutRenderer());
  }

  renderSection(section: PegaSection, context: PegaClipboardContext): string {
    const layouts = section.layouts ?? [];
    const fields = section.fields ?? [];
    const parts: string[] = [];

    for (const layout of layouts) {
      if (!this.isVisible(layout, context)) continue;
      parts.push(this.renderLayout(layout, context));
    }

    for (const field of fields) {
      if (!this.isVisible(field, context)) continue;
      parts.push(this.fieldRenderer.renderField(field, context));
    }

    return `<div class="pega-section">${parts.join('')}</div>`;
  }

  private renderLayout(layout: PegaLayout, context: PegaClipboardContext): string {
    const renderer = layout.type ? this.renderers.get(layout.type) : this.renderers.get('dynamic');
    if (!renderer) {
      return `<div class="pega-unknown-layout">${layout.type ?? 'unknown'}</div>`;
    }
    return renderer.render(layout, context, this.fieldRenderer, this.renderLayout.bind(this));
  }

  private isVisible(element: PegaLayout | PegaField, context: PegaClipboardContext): boolean {
    return this.visibilityEvaluator.evaluate({
      visible: element.visible,
      when: element.when,
    }, context);
  }
}