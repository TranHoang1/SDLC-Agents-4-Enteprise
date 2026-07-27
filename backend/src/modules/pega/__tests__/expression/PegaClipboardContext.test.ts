import { describe, it, expect } from 'vitest';
import { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import { PegExpressionError } from '../../expression/PegaExpressionAst.js';

describe('PegaClipboardContext', () => {
  it('resolves simple property on current page', () => {
    const ctx = new PegaClipboardContext({
      pyWorkPage: {
        Name: { type: 'Text', value: 'Acme Corp' },
      },
    });
    const val = ctx.resolve(['Name']);
    expect(val.text).toBe('Acme Corp');
  });

  it('resolves chained page', () => {
    const ctx = new PegaClipboardContext({
      pyWorkPage: {
        Customer: {
          Name: { type: 'Text', value: 'John' },
        },
      },
    });
    const val = ctx.resolve(['Customer']);
    expect(val.type).toBe('Page');
  });

  it('resolves property on named page', () => {
    const ctx = new PegaClipboardContext({
      pyWorkPage: {
        Customer: {
          Name: { type: 'Text', value: 'John' },
        },
      },
    });
    const val = ctx.resolve(['Customer', 'Name']);
    expect(val.text).toBe('John');
  });

  it('throws on missing property', () => {
    const ctx = new PegaClipboardContext({ pyWorkPage: {} });
    expect(() => ctx.resolve(['Missing'])).toThrow(PegExpressionError);
  });

  it('throws on missing page', () => {
    const ctx = new PegaClipboardContext({ pyWorkPage: {} });
    expect(() => ctx.resolve(['NoPage', 'Prop'])).toThrow(PegExpressionError);
  });

  it('handles nested page structure', () => {
    const ctx = new PegaClipboardContext({
      pyWorkPage: {
        Order: {
          Total: { type: 'Number', value: 150 },
          Items: {
            Count: { type: 'Number', value: 3 },
          },
        },
      },
    });
    expect(ctx.resolve(['Order', 'Total']).number).toBe(150);
  });
});
