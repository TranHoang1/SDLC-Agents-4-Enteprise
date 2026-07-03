/**
 * HTML to text extraction utility.
 * Strips tags, extracts text, supports CSS selector extraction.
 */

export class HtmlExtractor {
  toText(html: string): string {
    if (!html) return '';
    let text = html;
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }

  extractBySelector(html: string, selector: string): string {
    const regex = this.selectorToRegex(selector);
    const match = html.match(regex);
    if (!match) return '';
    return this.toText(match[0]);
  }

  private selectorToRegex(selector: string): RegExp {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return new RegExp(`<[^>]+class="[^"]*${cls}[^"]*"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'i');
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return new RegExp(`<[^>]+id="${id}"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'i');
    }
    return new RegExp(`<${selector}[^>]*>[\\s\\S]*?<\\/${selector}>`, 'i');
  }
}
