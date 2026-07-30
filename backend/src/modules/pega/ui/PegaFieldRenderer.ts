import type { PegaField } from './PegaUITypes.js';
import type { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import { PegaHtmlSanitizer } from '../security/PegaHtmlSanitizer.js';

export class PegaFieldRenderer {
  private sanitizer = new PegaHtmlSanitizer();

  renderField(field: PegaField, context: PegaClipboardContext): string {
    const label = field.label ?? field.name;
    const displayType = field.type ?? 'Text';
    const displayValue = this.formatValue(field, context);
    const safeLabel = this.sanitizer.sanitize(label);
    const safeValue = this.sanitizer.sanitize(displayValue);

    return `<div class="pega-field"><label class="pega-field-label">${safeLabel} (${displayType})</label><div class="pega-field-value">${safeValue}</div></div>`;
  }

  private formatValue(field: PegaField, _context: PegaClipboardContext): string {
    const val = field.value;
    const type = field.type ?? 'Text';

    if (val === null || val === undefined) {
      return '\u2014';
    }

    switch (type) {
      case 'Boolean':
      case 'TrueFalse':
        return val ? 'Yes' : 'No';
      case 'DateTime':
      case 'Date':
        return val instanceof Date ? val.toISOString() : String(val);
      case 'Page':
        return `[Page: ${field.name}]`;
      case 'PageList':
        if (Array.isArray(val)) {
          return `[PageList: ${val.length} items]`;
        }
        return `[PageList: 0 items]`;
      default:
        return String(val);
    }
  }
}