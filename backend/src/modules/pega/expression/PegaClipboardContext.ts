import { PegValue, PegExpressionError } from './PegaExpressionAst.js';

interface PageNode {
  name: string;
  properties: Map<string, PegValue>;
  pages: Map<string, PageNode>;
  parent?: PageNode;
}

export class PegaClipboardContext {
  private root: PageNode;

  constructor(
    private pages: Record<string, Record<string, unknown>> = {},
    private currentPageName: string = 'pyWorkPage',
  ) {
    this.root = { name: '__root__', properties: new Map(), pages: new Map() };
    this.loadPages();
  }

  private loadPages(): void {
    for (const [pageName, pageData] of Object.entries(this.pages)) {
      this.root.pages.set(pageName, this.buildPage(pageName, pageData, this.root));
    }
  }

  private buildPage(name: string, data: Record<string, unknown>, parent?: PageNode): PageNode {
    const properties = new Map<string, PegValue>();
    const childPages = new Map<string, PageNode>();

    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !('type' in (val as any))) {
        const childPage = this.buildPage(key, val as Record<string, unknown>);
        childPage.parent = parent;
        childPages.set(key, childPage);
      } else if (val && typeof val === 'object' && 'type' in (val as any) && 'value' in (val as any)) {
        const tv = val as { type: string; value: unknown };
        properties.set(key, new PegValue(tv.type as any, tv.value));
      } else if (typeof val === 'string') {
        properties.set(key, PegValue.text(val));
      } else if (typeof val === 'number') {
        properties.set(key, PegValue.number(val));
      } else if (typeof val === 'boolean') {
        properties.set(key, PegValue.bool(val));
      } else if (val === null || val === undefined) {
        properties.set(key, PegValue.null());
      }
    }

    return { name, properties, pages: childPages, parent };
  }

  resolve(parts: string[]): PegValue {
    if (parts.length === 0) {
      throw new PegExpressionError('Empty property reference', 'PROPERTY_NOT_FOUND');
    }

    if (parts.length === 1) {
      return this.resolveRelative(parts[0]);
    }

    const pageName = parts[0];
    const page = this.findPage(pageName);
    if (!page) {
      throw new PegExpressionError(
        "Page '" + pageName + "' not found in clipboard context",
        'PROPERTY_NOT_FOUND',
      );
    }

    let current: PageNode = page;
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        const prop = current.properties.get(part);
        if (prop) return prop;
        throw new PegExpressionError(
          "Property '" + parts.slice(0, i + 1).join('.') + "' not found in clipboard",
          'PROPERTY_NOT_FOUND',
        );
      }
      const childPage = current.pages.get(part);
      if (childPage) {
        current = childPage;
      } else {
        throw new PegExpressionError(
          "Page '" + parts.slice(0, i + 1).join('.') + "' not found in clipboard",
          'PROPERTY_NOT_FOUND',
        );
      }
    }

    return PegValue.page(current.name, this);
  }

  private resolveRelative(propName: string): PegValue {
    const currentPage = this.root.pages.get(this.currentPageName);
    if (!currentPage) {
      throw new PegExpressionError(
        "Current page '" + this.currentPageName + "' not found in clipboard",
        'PROPERTY_NOT_FOUND',
      );
    }

    const prop = currentPage.properties.get(propName);
    if (prop) return prop;

    const childPage = currentPage.pages.get(propName);
    if (childPage) return PegValue.page(childPage.name, this);

    throw new PegExpressionError(
      "Property '" + propName + "' not found in clipboard (current page: " + this.currentPageName + ")",
      'PROPERTY_NOT_FOUND',
    );
  }

  private findPage(name: string): PageNode | undefined {
    const page = this.root.pages.get(name);
    if (page) return page;
    for (const [, p] of this.root.pages) {
      const found = this.findPageInTree(p, name);
      if (found) return found;
    }
    return undefined;
  }

  private findPageInTree(node: PageNode, name: string): PageNode | undefined {
    if (node.name === name) return node;
    for (const [, child] of node.pages) {
      const found = this.findPageInTree(child, name);
      if (found) return found;
    }
    return undefined;
  }

  setCurrentPage(name: string): void {
    this.currentPageName = name;
  }

  getCurrentPageName(): string {
    return this.currentPageName;
  }
}
