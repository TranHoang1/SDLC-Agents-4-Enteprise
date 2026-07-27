import type { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import { PegExpressionError } from '../expression/PegaExpressionAst.js';

export function resolveFieldValue(
  fieldPath: string,
  context: PegaClipboardContext,
): unknown {
  try {
    const cleaned = fieldPath.startsWith('.') ? fieldPath.slice(1) : fieldPath;
    const parts = cleaned.split('.');
    const result = context.resolve(parts);
    return result.value;
  } catch (err: unknown) {
    if (err instanceof PegExpressionError) {
      return null;
    }
    return null;
  }
}