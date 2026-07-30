import type { PegaLayout } from '../PegaUITypes.js';
import type { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaFieldRenderer } from '../PegaFieldRenderer.js';

export type LayoutRenderFunction = (
  layout: PegaLayout,
  context: PegaClipboardContext,
  fieldRenderer: PegaFieldRenderer,
) => string;

export abstract class PegaLayoutRenderer {
  abstract render(
    layout: PegaLayout,
    context: PegaClipboardContext,
    fieldRenderer: PegaFieldRenderer,
    renderSubLayout: LayoutRenderFunction,
  ): string;
}