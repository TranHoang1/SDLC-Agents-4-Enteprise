export class PegaHtmlSanitizer {
  sanitize(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        result[key] = this.sanitize(val);
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = this.sanitizeObject(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  sanitizeArray(arr: string[]): string[] {
    return arr.map(s => this.sanitize(s));
  }
}
