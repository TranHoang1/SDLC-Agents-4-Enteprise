import { describe, it, expect } from 'vitest';
import { PegaDynamicLayoutRenderer } from '../../ui/layouts/PegaDynamicLayoutRenderer.js';
import { PegaTabLayoutRenderer } from '../../ui/layouts/PegaTabLayoutRenderer.js';
import { PegaRepeatingLayoutRenderer } from '../../ui/layouts/PegaRepeatingLayoutRenderer.js';
import { PegaTableLayoutRenderer } from '../../ui/layouts/PegaTableLayoutRenderer.js';
import { PegaFieldRenderer } from '../../ui/PegaFieldRenderer.js';
import { PegaVisibilityEvaluator } from '../../ui/PegaVisibilityEvaluator.js';
import { PegaSectionRenderer } from '../../ui/PegaSectionRenderer.js';
import { PegaHarnessAssembler } from '../../ui/PegaHarnessAssembler.js';
import { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaLayout, PegaSection, PegaField } from '../../ui/PegaUITypes.js';

function createContext(): PegaClipboardContext {
  return new PegaClipboardContext({
    pyWorkPage: {
      Status: { type: 'Text', value: 'Open' },
      Amount: { type: 'Number', value: 150.5 },
      CustomerName: { type: 'Text', value: 'John Doe' },
      Email: { type: 'Text', value: 'john@example.com' },
    },
  });
}

function createMockFieldRenderer() {
  return {
    renderField: (field: PegaField, _context: PegaClipboardContext): string => {
      const val = field.value ?? '';
      return `<mock-field name="${field.name}">${val}</mock-field>`;
    },
  };
}

function createMockRenderSubLayout() {
  return (layout: PegaLayout, _context: PegaClipboardContext, _fieldRenderer: unknown): string => {
    if (layout.fields && layout.fields.length > 0) {
      return layout.fields.map(f => `[sub:${f.name}]`).join('');
    }
    return `[sub-layout:${layout.type ?? 'dynamic'}]`;
  };
}

function createDateValue(): Date {
  return new Date('2026-07-27T12:00:00.000Z');
}

describe('PegaDynamicLayoutRenderer', () => {
  const renderer = new PegaDynamicLayoutRenderer();
  const context = createContext();
  const mockFieldRenderer = createMockFieldRenderer();
  const mockRenderSubLayout = createMockRenderSubLayout();

  it('renders children in a flex container', () => {
    const layout: PegaLayout = {
      type: 'dynamic',
      children: [
        {
          fields: [
            { name: 'CustomerName', label: 'Customer Name', value: 'John Doe' },
          ],
        },
        {
          fields: [
            { name: 'Email', label: 'Email', value: 'john@example.com' },
          ],
        },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-dynamic-layout"');
    expect(output).toContain('display:flex');
    expect(output).toContain('flex-wrap:wrap');
    expect(output).toContain('<mock-field name="CustomerName">');
    expect(output).toContain('<mock-field name="Email">');
  });

  it('returns empty flex container for no children and no fields', () => {
    const layout: PegaLayout = { type: 'dynamic' };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-dynamic-layout"');
    expect(output).toContain('display:flex');
    expect(output).toContain('></div>');
    expect(output).not.toContain('<mock-field');
  });

  it('applies columnCount as CSS width style on children', () => {
    const layout: PegaLayout = {
      type: 'dynamic',
      properties: { columnCount: 3 },
      fields: [
        { name: 'A', value: '1' },
        { name: 'B', value: '2' },
        { name: 'C', value: '3' },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('width:calc(33.333333333333336% - 8px)');
  });

  it('uses default single column when no columnCount specified', () => {
    const layout: PegaLayout = {
      type: 'dynamic',
      fields: [
        { name: 'Name', value: 'Test' },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('width:100%');
  });

  it('calls renderSubLayout for child with explicit non-dynamic type', () => {
    const layout: PegaLayout = {
      type: 'dynamic',
      children: [
        {
          type: 'tab',
          fields: [{ name: 'TabField', value: 'tab-val' }],
        },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('[sub:TabField]');
  });
});

describe('PegaTabLayoutRenderer', () => {
  const renderer = new PegaTabLayoutRenderer();
  const context = createContext();
  const mockFieldRenderer = createMockFieldRenderer();
  const mockRenderSubLayout = createMockRenderSubLayout();

  it('renders tab headers and panel sections', () => {
    const layout: PegaLayout = {
      type: 'tab',
      children: [
        {
          properties: { label: 'General' },
          fields: [{ name: 'Name', value: 'Alice' }],
        },
        {
          properties: { label: 'Details' },
          fields: [{ name: 'Email', value: 'alice@test.com' }],
        },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-tab-layout"');
    expect(output).toContain('class="pega-tabs"');
    expect(output).toContain('class="pega-tab-panels"');
    expect(output).toContain('>General<');
    expect(output).toContain('>Details<');
    expect(output).toContain('class="pega-tab-panel');
  });

  it('returns tab layout wrapper even with empty panels', () => {
    const layout: PegaLayout = { type: 'tab' };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-tab-layout"');
    expect(output).toContain('class="pega-tabs"');
    expect(output).toContain('class="pega-tab-panels"');
  });

  it('sets first tab as active', () => {
    const layout: PegaLayout = {
      type: 'tab',
      children: [
        {
          properties: { label: 'First Tab' },
          fields: [{ name: 'F1', value: 'v1' }],
        },
        {
          properties: { label: 'Second Tab' },
          fields: [{ name: 'F2', value: 'v2' }],
        },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-tab active">First Tab<');
    expect(output).toContain('class="pega-tab-panel active"');
    expect(output).toContain('class="pega-tab">Second Tab<');
    expect(output).toContain('class="pega-tab-panel"');
  });

  it('falls back to Tab N label when no label property given', () => {
    const layout: PegaLayout = {
      type: 'tab',
      children: [
        { fields: [{ name: 'X', value: 'x' }] },
        { fields: [{ name: 'Y', value: 'y' }] },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('>Tab 1<');
    expect(output).toContain('>Tab 2<');
  });
});

describe('PegaRepeatingLayoutRenderer', () => {
  const renderer = new PegaRepeatingLayoutRenderer();
  const context = createContext();
  const mockFieldRenderer = createMockFieldRenderer();
  const mockRenderSubLayout = createMockRenderSubLayout();

  it('renders each column as a table header and data row with fields', () => {
    const layout: PegaLayout = {
      type: 'repeating',
      children: [
        {
          properties: { label: 'Item Name' },
          fields: [{ name: 'ItemName', value: 'Widget' }],
        },
        {
          properties: { label: 'Quantity' },
          fields: [{ name: 'Qty', value: '3' }],
        },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-repeating"');
    expect(output).toContain('<th>Item Name</th>');
    expect(output).toContain('<th>Quantity</th>');
    expect(output).toContain('<mock-field name="ItemName">');
    expect(output).toContain('<mock-field name="Qty">');
  });

  it('returns table wrapper even with empty children and fields', () => {
    const layout: PegaLayout = { type: 'repeating' };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-repeating"');
  });

  it('includes field label and value in each cell from layout-level fields', () => {
    const layout: PegaLayout = {
      type: 'repeating',
      fields: [
        { name: 'ProductCode', label: 'Code', value: 'P-123' },
        { name: 'Price', label: 'Price', value: '29.99' },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('<th>Code</th>');
    expect(output).toContain('<th>Price</th>');
    expect(output).toContain('<mock-field name="ProductCode">');
    expect(output).toContain('<mock-field name="Price">');
  });

  it('uses field name as header label when no label on column child', () => {
    const layout: PegaLayout = {
      type: 'repeating',
      children: [
        { fields: [{ name: 'ColA' }] },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('<th>ColA</th>');
  });
});

describe('PegaTableLayoutRenderer', () => {
  const renderer = new PegaTableLayoutRenderer();
  const context = createContext();
  const mockFieldRenderer = createMockFieldRenderer();
  const mockRenderSubLayout = createMockRenderSubLayout();

  it('renders table with field headers and data cells', () => {
    const layout: PegaLayout = {
      type: 'table',
      fields: [
        { name: 'Product', label: 'Product Name', value: 'Laptop' },
        { name: 'Price', label: 'Price', value: '999.99' },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-table"');
    expect(output).toContain('<th>Product Name</th>');
    expect(output).toContain('<th>Price</th>');
    expect(output).toContain('<mock-field name="Product">');
    expect(output).toContain('<mock-field name="Price">');
  });

  it('returns table wrapper with no thead when fields are empty', () => {
    const layout: PegaLayout = { type: 'table' };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('class="pega-table"');
    expect(output).not.toContain('<thead>');
  });

  it('includes field labels in rendered output using name fallback', () => {
    const layout: PegaLayout = {
      type: 'table',
      fields: [
        { name: 'SKU', value: 'ABC-123' },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('<th>SKU</th>');
  });

  it('renders child layouts as additional rows with colspan', () => {
    const layout: PegaLayout = {
      type: 'table',
      fields: [
        { name: 'Item', label: 'Item', value: 'Desk' },
      ],
      children: [
        { type: 'dynamic', fields: [{ name: 'Note', value: 'Assembly required' }] },
      ],
    };
    const output = renderer.render(layout, context, mockFieldRenderer, mockRenderSubLayout);
    expect(output).toContain('colspan="1"');
    expect(output).toContain('[sub:Note]');
  });
});

describe('PegaFieldRenderer', () => {
  const renderer = new PegaFieldRenderer();
  const context = createContext();

  it('renders field label and formatted value for Text type', () => {
    const field: PegaField = { name: 'CustomerName', label: 'Customer Name', type: 'Text', value: 'John Doe' };
    const output = renderer.renderField(field, context);
    expect(output).toContain('Customer Name (Text)');
    expect(output).toContain('John Doe');
    expect(output).toContain('class="pega-field"');
    expect(output).toContain('class="pega-field-label"');
    expect(output).toContain('class="pega-field-value"');
  });

  it('uses field name as label when label is not provided', () => {
    const field: PegaField = { name: 'Email', type: 'Text', value: 'a@b.com' };
    const output = renderer.renderField(field, context);
    expect(output).toContain('Email (Text)');
    expect(output).toContain('a@b.com');
  });

  it('renders Boolean type as Yes/No', () => {
    const fieldTrue: PegaField = { name: 'Active', type: 'Boolean', value: true };
    const fieldFalse: PegaField = { name: 'Active', type: 'TrueFalse', value: false };
    expect(renderer.renderField(fieldTrue, context)).toContain('>Yes<');
    expect(renderer.renderField(fieldFalse, context)).toContain('>No<');
  });

  it('renders Page type as page reference', () => {
    const field: PegaField = { name: 'Customer', type: 'Page', value: {} };
    const output = renderer.renderField(field, context);
    expect(output).toContain('[Page: Customer]');
  });

  it('renders PageList type with item count', () => {
    const field: PegaField = { name: 'Orders', type: 'PageList', value: [{ id: 1 }, { id: 2 }] };
    const output = renderer.renderField(field, context);
    expect(output).toContain('[PageList: 2 items]');
  });

  it('renders empty PageList as 0 items', () => {
    const field: PegaField = { name: 'Items', type: 'PageList', value: [] };
    const output = renderer.renderField(field, context);
    expect(output).toContain('[PageList: 0 items]');
  });

  it('formats Date type value as ISO string', () => {
    const date = createDateValue();
    const field: PegaField = { name: 'Created', type: 'Date', value: date };
    const output = renderer.renderField(field, context);
    expect(output).toContain(date.toISOString());
  });

  it('formats DateTime type value as ISO string', () => {
    const date = createDateValue();
    const field: PegaField = { name: 'Timestamp', type: 'DateTime', value: date };
    const output = renderer.renderField(field, context);
    expect(output).toContain(date.toISOString());
  });

  it('renders em dash for null value', () => {
    const field: PegaField = { name: 'NullableField', type: 'Text', value: null };
    const output = renderer.renderField(field, context);
    expect(output).toContain('\u2014');
  });

  it('renders em dash for undefined value', () => {
    const field: PegaField = { name: 'MissingField', type: 'Text' };
    const output = renderer.renderField(field, context);
    expect(output).toContain('\u2014');
  });

  it('formats unknown type by falling through to String conversion', () => {
    const field: PegaField = { name: 'CustomProp', type: 'UnknownType', value: 'raw-value' };
    const output = renderer.renderField(field, context);
    expect(output).toContain('CustomProp (UnknownType)');
    expect(output).toContain('raw-value');
  });

  it('sanitizes HTML in field label and value', () => {
    const field: PegaField = { name: 'XSS', label: '<script>alert("xss")</script>', type: 'Text', value: '<b>bold</b>' };
    const output = renderer.renderField(field, context);
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('<b>');
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('&lt;b&gt;');
  });
});

describe('PegaVisibilityEvaluator', () => {
  const evaluator = new PegaVisibilityEvaluator();
  const context = createContext();

  it('returns true for element with visible undefined and no when', () => {
    const result = evaluator.evaluate({}, context);
    expect(result).toBe(true);
  });

  it('returns true for element with visible true', () => {
    const result = evaluator.evaluate({ visible: true }, context);
    expect(result).toBe(true);
  });

  it('returns false for element with visible false', () => {
    const result = evaluator.evaluate({ visible: false }, context);
    expect(result).toBe(false);
  });

  it('returns true when when condition evaluates to true via expression evaluator', () => {
    const result = evaluator.evaluate({ when: '.Status = "Open"' }, context);
    expect(result).toBe(true);
  });

  it('returns false when when condition evaluates to false via expression evaluator', () => {
    const result = evaluator.evaluate({ when: '.Status = "Closed"' }, context);
    expect(result).toBe(false);
  });

  it('returns true for null when ignoring visible true explicitly', () => {
    const result = evaluator.evaluate({ visible: true, when: null as unknown as string }, context);
    expect(result).toBe(true);
  });

  it('returns true when when is an empty string', () => {
    const result = evaluator.evaluate({ when: '' }, context);
    expect(result).toBe(true);
  });
});

describe('PegaSectionRenderer', () => {
  const renderer = new PegaSectionRenderer();
  const context = createContext();

  it('renders a section with a dynamic layout containing fields', () => {
    const section: PegaSection = {
      name: 'MainInfo',
      layouts: [
        {
          type: 'dynamic',
          fields: [
            { name: 'CustomerName', label: 'Customer Name', value: 'John Doe' },
            { name: 'Email', label: 'Email', value: 'john@example.com' },
          ],
        },
      ],
      fields: [],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('class="pega-section"');
    expect(output).toContain('class="pega-dynamic-layout"');
    expect(output).toContain('Customer Name (Text)');
    expect(output).toContain('Email (Text)');
    expect(output).toContain('John Doe');
    expect(output).toContain('john@example.com');
  });

  it('renders a section with a tab layout', () => {
    const section: PegaSection = {
      name: 'TabSection',
      layouts: [
        {
          type: 'tab',
          children: [
            {
              properties: { label: 'Info' },
              fields: [{ name: 'Name', label: 'Name', value: 'Alice' }],
            },
            {
              properties: { label: 'Settings' },
              fields: [{ name: 'Mode', label: 'Mode', value: 'Auto' }],
            },
          ],
        },
      ],
      fields: [],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('class="pega-section"');
    expect(output).toContain('class="pega-tab-layout"');
    expect(output).toContain('>Info<');
    expect(output).toContain('>Settings<');
    expect(output).toContain('>Alice<');
    expect(output).toContain('>Auto<');
  });

  it('renders a section with a repeating layout', () => {
    const section: PegaSection = {
      name: 'RepeatSection',
      layouts: [
        {
          type: 'repeating',
          children: [
            {
              properties: { label: 'Product' },
              fields: [{ name: 'ProductName', label: 'Product Name', value: 'Widget' }],
            },
            {
              properties: { label: 'Price' },
              fields: [{ name: 'UnitPrice', label: 'Unit Price', value: '19.99' }],
            },
          ],
        },
      ],
      fields: [],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('class="pega-section"');
    expect(output).toContain('class="pega-repeating"');
    expect(output).toContain('<th>Product</th>');
    expect(output).toContain('<th>Price</th>');
  });

  it('renders a section with a table layout', () => {
    const section: PegaSection = {
      name: 'TableSection',
      layouts: [
        {
          type: 'table',
          fields: [
            { name: 'Item', label: 'Item', value: 'Desk' },
            { name: 'Qty', label: 'Quantity', value: '2' },
          ],
        },
      ],
      fields: [],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('class="pega-section"');
    expect(output).toContain('class="pega-table"');
    expect(output).toContain('<th>Item</th>');
    expect(output).toContain('<th>Quantity</th>');
  });

  it('renders fields directly on section when no layouts present', () => {
    const section: PegaSection = {
      name: 'DirectFields',
      layouts: [],
      fields: [
        { name: 'DirectField', label: 'Direct Field', type: 'Text', value: 'hello' },
      ],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('Direct Field (Text)');
    expect(output).toContain('hello');
  });

  it('skips fields that are not visible', () => {
    const section: PegaSection = {
      name: 'WithHidden',
      layouts: [],
      fields: [
        { name: 'VisibleField', label: 'Visible', type: 'Text', value: 'shown' },
        { name: 'HiddenField', label: 'Hidden', type: 'Text', value: 'secret', visible: false },
      ],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('shown');
    expect(output).not.toContain('secret');
  });

  it('skips layouts that are not visible', () => {
    const section: PegaSection = {
      name: 'WithHiddenLayout',
      layouts: [
        { type: 'dynamic', fields: [{ name: 'A', value: 'visible' }] },
        { type: 'dynamic', fields: [{ name: 'B', value: 'hidden' }], visible: false },
      ],
      fields: [],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('visible');
    expect(output).not.toContain('hidden');
  });

  it('uses dynamic renderer as default when no type specified on layout', () => {
    const section: PegaSection = {
      name: 'DefaultDynamic',
      layouts: [
        {
          fields: [
            { name: 'DefaultField', label: 'Default', type: 'Text', value: 'works' },
          ],
        },
      ],
      fields: [],
    };
    const output = renderer.renderSection(section, context);
    expect(output).toContain('class="pega-dynamic-layout"');
    expect(output).toContain('Default (Text)');
    expect(output).toContain('works');
  });
});

describe('PegaHarnessAssembler', () => {
  const assembler = new PegaHarnessAssembler();
  const context = createContext();

  it('assembles a full HTML document with doctype, html, head, and body', () => {
    const sections = {
      header: { name: 'Header', layouts: [], fields: [] },
      content: { name: 'Content', layouts: [], fields: [] },
      footer: { name: 'Footer', layouts: [], fields: [] },
    };
    const output = assembler.assemble(sections, context);
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<html lang="en">');
    expect(output).toContain('<head>');
    expect(output).toContain('<meta charset="UTF-8">');
    expect(output).toContain('<meta name="viewport"');
    expect(output).toContain('<title>Pega Harness Preview</title>');
    expect(output).toContain('</head>');
    expect(output).toContain('<body>');
    expect(output).toContain('</body>');
    expect(output).toContain('</html>');
  });

  it('includes header, content, and footer sections rendered in the HTML', () => {
    const sections: { header?: PegaSection; content?: PegaSection; footer?: PegaSection } = {
      header: {
        name: 'AppHeader',
        layouts: [
          { type: 'dynamic', fields: [{ name: 'Title', label: 'Title', type: 'Text', value: 'My App' }] },
        ],
        fields: [],
      },
      content: {
        name: 'MainContent',
        layouts: [
          { type: 'dynamic', fields: [{ name: 'Body', label: 'Body', type: 'Text', value: 'Hello World' }] },
        ],
        fields: [],
      },
      footer: {
        name: 'AppFooter',
        layouts: [
          { type: 'dynamic', fields: [{ name: 'Copyright', label: 'Copyright', type: 'Text', value: '2026' }] },
        ],
        fields: [],
      },
    };
    const output = assembler.assemble(sections, context);
    expect(output).toContain('<header class="pega-header">');
    expect(output).toContain('<main class="pega-content">');
    expect(output).toContain('<footer class="pega-footer">');
    expect(output).toContain('My App');
    expect(output).toContain('Hello World');
    expect(output).toContain('2026');
  });

  it('contains inline CSS styles in a style tag', () => {
    const sections = {
      content: { name: 'Content', layouts: [], fields: [] },
    };
    const output = assembler.assemble(sections, context);
    expect(output).toContain('<style>');
    expect(output).toContain('</style>');
    expect(output).toContain('.pega-header');
    expect(output).toContain('.pega-content');
    expect(output).toContain('.pega-footer');
    expect(output).toContain('.pega-section');
    expect(output).toContain('.pega-dynamic-layout');
    expect(output).toContain('.pega-tab-layout');
    expect(output).toContain('.pega-tab.active');
    expect(output).toContain('.pega-repeating');
    expect(output).toContain('.pega-table');
    expect(output).toContain('.pega-field');
  });

  it('excludes header section when not provided', () => {
    const sections = {
      content: { name: 'Content', layouts: [], fields: [] },
    };
    const output = assembler.assemble(sections, context);
    expect(output).not.toContain('<header');
    expect(output).toContain('<main');
    expect(output).not.toContain('<footer');
  });
});
