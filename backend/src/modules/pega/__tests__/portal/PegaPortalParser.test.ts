import { describe, it, expect } from 'vitest';
import { PegaPortalParser } from '../../portal/PegaPortalParser.js';
import { PegaSectionRenderer } from '../../ui/PegaSectionRenderer.js';
import { PegaHarnessAssembler } from '../../ui/PegaHarnessAssembler.js';
import { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import { PORTAL_RULE_CLASSES } from '../../portal/PegaPortalTypes.js';
import type { Section } from '../../portal/PegaPortalTypes.js';

function createContext(): PegaClipboardContext {
  return new PegaClipboardContext({
    pyWorkPage: {
      Status: { type: 'Text', value: 'Open' },
      Amount: { type: 'Number', value: 150.5 },
      CustomerName: { type: 'Text', value: 'John Doe' },
    },
  });
}

function sectionJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pxObjClass: 'Rule-HTML-Section',
    pyRuleName: 'TestSection',
    pyName: 'TestSection',
    pyType: 'Section',
    pyClassName: 'Work-Order',
    pyLayouts: [
      {
        type: 'dynamic',
        fields: [
          { name: 'CustomerName', label: 'Customer Name', type: 'Text', value: 'John Doe' },
          { name: 'Amount', label: 'Amount', type: 'Number', value: 150.5 },
        ],
      },
    ],
    pyFields: [
      { name: 'Status', label: 'Status', type: 'Text', value: 'Open' },
    ],
    ...overrides,
  };
}

function harnessJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pxObjClass: 'Rule-HTML-Harness',
    pyRuleName: 'TestHarness',
    pyName: 'TestHarness',
    pyClassName: 'Work-Order',
    pyHeader: {
      pyName: 'HeaderSection',
      pyLayouts: [
        { type: 'dynamic', fields: [{ name: 'Title', label: 'Title', type: 'Text', value: 'Header Title' }] },
      ],
      pyFields: [],
    },
    pyContent: {
      pyName: 'ContentSection',
      pyLayouts: [
        { type: 'dynamic', fields: [{ name: 'Body', label: 'Body', type: 'Text', value: 'Main Content' }] },
      ],
      pyFields: [],
    },
    pyFooter: {
      pyName: 'FooterSection',
      pyLayouts: [
        { type: 'dynamic', fields: [{ name: 'Copyright', label: 'Copyright', type: 'Text', value: '2026' }] },
      ],
      pyFields: [],
    },
    pyPortal: 'MyPortal',
    pySkin: 'MySkin',
    ...overrides,
  };
}

function flowActionJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pxObjClass: 'Rule-HTML-FlowAction',
    pyRuleName: 'ApproveAction',
    pyName: 'ApproveAction',
    pyClassName: 'Work-Order',
    pyLayouts: [
      {
        type: 'dynamic',
        fields: [{ name: 'Comment', label: 'Comment', type: 'Text', value: '' }],
      },
    ],
    pyFields: [],
    ...overrides,
  };
}

function portalJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pxObjClass: 'Rule-Portal',
    pyRuleName: 'MyPortal',
    pyName: 'MyPortal',
    pyLabel: 'My Custom Portal',
    pyClassName: 'Work-Order',
    pyPortals: ['SubPortalA', 'SubPortalB'],
    pySkins: ['CorporateSkin'],
    ...overrides,
  };
}

function skinJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pxObjClass: 'Rule-Portal-Skin',
    pyRuleName: 'CorporateSkin',
    pyName: 'CorporateSkin',
    pyClassName: '@baseclass',
    pyColors: { primary: '#1976d2', secondary: '#f5f5f5', accent: '#ff5722' },
    pyBackground: '#ffffff',
    pyFonts: { heading: 'Roboto', body: 'Open Sans' },
    ...overrides,
  };
}

function navigationJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pxObjClass: 'Rule-Navigation',
    pyRuleName: 'MainNav',
    pyName: 'MainNav',
    pyClassName: '@baseclass',
    pyMenuItems: [
      { label: 'Home', url: '/home', icon: 'home' },
      { label: 'Orders', url: '/orders', icon: 'list' },
      {
        label: 'Admin',
        icon: 'settings',
        children: [
          { label: 'Users', url: '/admin/users' },
          { label: 'Config', url: '/admin/config' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('PegaPortalParser — Section type parsing with layouts', () => {
  const parser = new PegaPortalParser();

  it('parses a Section with dynamic layout and fields', () => {
    const json = sectionJson();
    const section = parser.parseSection(json);
    expect(section.pyName).toBe('TestSection');
    expect(section.pyType).toBe('Section');
    expect(section.pyLayouts).toHaveLength(1);
    expect(section.pyLayouts[0].type).toBe('dynamic');
    expect(section.pyLayouts[0].fields).toHaveLength(2);
    expect(section.pyLayouts[0].fields![0].name).toBe('CustomerName');
    expect(section.pyLayouts[0].fields![1].name).toBe('Amount');
    expect(section.pyFields).toHaveLength(1);
    expect(section.pyFields[0].name).toBe('Status');
  });

  it('converts Section to PegaSection format compatible with PegaSectionRenderer', () => {
    const json = sectionJson();
    const section = parser.parseSection(json);
    const pegaSection = parser.sectionToPegaFormat(section);
    expect(pegaSection.name).toBe('TestSection');
    expect(pegaSection.layouts).toHaveLength(1);
    expect(pegaSection.layouts[0].type).toBe('dynamic');
    expect(pegaSection.layouts[0].fields).toHaveLength(2);
    expect(pegaSection.fields).toHaveLength(1);
  });

  it('renders the section through PegaSectionRenderer producing HTML', () => {
    const json = sectionJson();
    const section = parser.parseSection(json);
    const pegaSection = parser.sectionToPegaFormat(section);
    const renderer = new PegaSectionRenderer();
    const context = createContext();
    const html = renderer.renderSection(pegaSection, context);
    expect(html).toContain('class="pega-section"');
    expect(html).toContain('class="pega-dynamic-layout"');
    expect(html).toContain('Customer Name (Text)');
    expect(html).toContain('Amount (Number)');
    expect(html).toContain('John Doe');
    expect(html).toContain('150.5');
    expect(html).toContain('Status (Text)');
    expect(html).toContain('Open');
  });

  it('handles section with tab layout having children', () => {
    const json = sectionJson({
      pyLayouts: [
        {
          type: 'tab',
          children: [
            {
              properties: { label: 'General' },
              fields: [{ name: 'Name', label: 'Name', value: 'Alice' }],
            },
            {
              properties: { label: 'Details' },
              fields: [{ name: 'Email', label: 'Email', value: 'alice@test.com' }],
            },
          ],
        },
      ],
      pyFields: [],
    });
    const section = parser.parseSection(json);
    const pegaSection = parser.sectionToPegaFormat(section);
    const renderer = new PegaSectionRenderer();
    const context = createContext();
    const html = renderer.renderSection(pegaSection, context);
    expect(html).toContain('class="pega-tab-layout"');
    expect(html).toContain('>General<');
    expect(html).toContain('>Details<');
    expect(html).toContain('>Alice<');
    expect(html).toContain('>alice@test.com<');
  });

  it('handles section with repeating layout', () => {
    const json = sectionJson({
      pyLayouts: [
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
      pyFields: [],
    });
    const section = parser.parseSection(json);
    const pegaSection = parser.sectionToPegaFormat(section);
    const renderer = new PegaSectionRenderer();
    const context = createContext();
    const html = renderer.renderSection(pegaSection, context);
    expect(html).toContain('class="pega-repeating"');
    expect(html).toContain('<th>Product</th>');
    expect(html).toContain('<th>Price</th>');
  });

  it('handles section with table layout', () => {
    const json = sectionJson({
      pyLayouts: [
        {
          type: 'table',
          fields: [
            { name: 'Item', label: 'Item', value: 'Desk' },
            { name: 'Qty', label: 'Quantity', value: '2' },
          ],
        },
      ],
      pyFields: [],
    });
    const section = parser.parseSection(json);
    const pegaSection = parser.sectionToPegaFormat(section);
    const renderer = new PegaSectionRenderer();
    const context = createContext();
    const html = renderer.renderSection(pegaSection, context);
    expect(html).toContain('class="pega-table"');
    expect(html).toContain('<th>Item</th>');
    expect(html).toContain('<th>Quantity</th>');
  });
});

describe('PegaPortalParser — Harness type with header/content/footer', () => {
  const parser = new PegaPortalParser();

  it('parses Harness with header, content, footer sections', () => {
    const json = harnessJson();
    const harness = parser.parseHarness(json);
    expect(harness.pyName).toBe('TestHarness');
    expect(harness.pyType).toBe('Harness');
    expect(harness.pyHeader).toBeDefined();
    expect(harness.pyContent).toBeDefined();
    expect(harness.pyFooter).toBeDefined();
    expect(harness.pyHeader!.pyName).toBe('HeaderSection');
    expect(harness.pyContent!.pyName).toBe('ContentSection');
    expect(harness.pyFooter!.pyName).toBe('FooterSection');
    expect(harness.pyPortal).toBe('MyPortal');
    expect(harness.pySkin).toBe('MySkin');
  });

  it('assembles harness sections through PegaHarnessAssembler producing full HTML', () => {
    const json = harnessJson();
    const harness = parser.parseHarness(json);
    const headerPega = parser.sectionToPegaFormat(harness.pyHeader!);
    const contentPega = parser.sectionToPegaFormat(harness.pyContent!);
    const footerPega = parser.sectionToPegaFormat(harness.pyFooter!);
    const assembler = new PegaHarnessAssembler();
    const context = createContext();
    const html = assembler.assemble({ header: headerPega, content: contentPega, footer: footerPega }, context);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<header class="pega-header">');
    expect(html).toContain('<main class="pega-content">');
    expect(html).toContain('<footer class="pega-footer">');
    expect(html).toContain('Header Title');
    expect(html).toContain('Main Content');
    expect(html).toContain('2026');
  });

  it('handles harness with missing header and footer', () => {
    const json = harnessJson({ pyHeader: undefined, pyFooter: undefined });
    const harness = parser.parseHarness(json);
    expect(harness.pyHeader).toBeUndefined();
    expect(harness.pyContent).toBeDefined();
    expect(harness.pyFooter).toBeUndefined();
  });
});

describe('PegaPortalParser — FlowAction type', () => {
  const parser = new PegaPortalParser();

  it('parses FlowAction with layouts and fields', () => {
    const json = flowActionJson();
    const fa = parser.parseFlowAction(json);
    expect(fa.pyName).toBe('ApproveAction');
    expect(fa.pyType).toBe('FlowAction');
    expect(fa.pyLayouts).toHaveLength(1);
    expect(fa.pyLayouts[0].type).toBe('dynamic');
    expect(fa.pyLayouts[0].fields).toHaveLength(1);
    expect(fa.pyLayouts[0].fields![0].name).toBe('Comment');
    expect(fa.pyFields).toHaveLength(0);
  });

  it('renders FlowAction layouts through PegaSectionRenderer', () => {
    const json = flowActionJson({ pyFields: [{ name: 'Notes', label: 'Notes', type: 'Text', value: 'test note' }] });
    const fa = parser.parseFlowAction(json);
    const layoutSection: Section = {
      pyName: fa.pyName,
      pyType: 'Section',
      pyLayouts: fa.pyLayouts,
      pyFields: fa.pyFields,
    };
    const pegaSection = parser.sectionToPegaFormat(layoutSection);
    const renderer = new PegaSectionRenderer();
    const context = createContext();
    const html = renderer.renderSection(pegaSection, context);
    expect(html).toContain('Comment');
    expect(html).toContain('Notes (Text)');
    expect(html).toContain('test note');
  });
});

describe('PegaPortalParser — Portal with sub-portals and skins', () => {
  const parser = new PegaPortalParser();

  it('parses Portal with sub-portals and skin references', () => {
    const json = portalJson();
    const portal = parser.parsePortal(json);
    expect(portal.pyName).toBe('MyPortal');
    expect(portal.pyLabel).toBe('My Custom Portal');
    expect(portal.pyPortals).toEqual(['SubPortalA', 'SubPortalB']);
    expect(portal.pySkins).toEqual(['CorporateSkin']);
  });

  it('parses portal with empty sub-portals and skins lists', () => {
    const json = portalJson({ pyPortals: [], pySkins: [] });
    const portal = parser.parsePortal(json);
    expect(portal.pyPortals).toEqual([]);
    expect(portal.pySkins).toEqual([]);
  });
});

describe('PegaPortalParser — Skin with visual properties', () => {
  const parser = new PegaPortalParser();

  it('parses Skin with colors, background, and fonts', () => {
    const json = skinJson();
    const skin = parser.parseSkin(json);
    expect(skin.pyName).toBe('CorporateSkin');
    expect(skin.pyColors).toEqual({ primary: '#1976d2', secondary: '#f5f5f5', accent: '#ff5722' });
    expect(skin.pyBackground).toBe('#ffffff');
    expect(skin.pyFonts).toEqual({ heading: 'Roboto', body: 'Open Sans' });
  });

  it('handles skin missing optional properties', () => {
    const json = skinJson({ pyColors: undefined, pyBackground: undefined, pyFonts: undefined });
    const skin = parser.parseSkin(json);
    expect(skin.pyName).toBe('CorporateSkin');
    expect(skin.pyColors).toBeUndefined();
    expect(skin.pyBackground).toBeUndefined();
    expect(skin.pyFonts).toBeUndefined();
  });
});

describe('PegaPortalParser — Navigation with menu items', () => {
  const parser = new PegaPortalParser();

  it('parses Navigation with top-level and nested menu items', () => {
    const json = navigationJson();
    const nav = parser.parseNavigation(json);
    expect(nav.pyName).toBe('MainNav');
    expect(nav.pyMenuItems).toHaveLength(3);
    expect(nav.pyMenuItems[0].label).toBe('Home');
    expect(nav.pyMenuItems[0].url).toBe('/home');
    expect(nav.pyMenuItems[0].icon).toBe('home');
    expect(nav.pyMenuItems[2].label).toBe('Admin');
    expect(nav.pyMenuItems[2].children).toHaveLength(2);
    expect(nav.pyMenuItems[2].children![0].label).toBe('Users');
    expect(nav.pyMenuItems[2].children![0].url).toBe('/admin/users');
    expect(nav.pyMenuItems[2].children![1].label).toBe('Config');
  });

  it('handles navigation with empty menu items', () => {
    const json = navigationJson({ pyMenuItems: [] });
    const nav = parser.parseNavigation(json);
    expect(nav.pyMenuItems).toEqual([]);
  });
});

describe('PegaPortalParser — supports() for all UI/Portal types', () => {
  const parser = new PegaPortalParser();

  it.each(PORTAL_RULE_CLASSES)('supports %s', (cls) => {
    expect(parser.supports(cls)).toBe(true);
  });

  it('does not support non-Portal rule types', () => {
    expect(parser.supports('Rule-Obj-Activity')).toBe(false);
    expect(parser.supports('Rule-Obj-Model')).toBe(false);
    expect(parser.supports('Data-Admin-Operator-ID')).toBe(false);
    expect(parser.supports('')).toBe(false);
  });
});

describe('PegaPortalParser — parse() and IPegaRuleParserStrategy integration', () => {
  const parser = new PegaPortalParser();

  it('returns symbol and dependencies from parse for Section', () => {
    const json = sectionJson();
    const result = parser.parse(json);
    expect(result.symbol.fqn).toContain('Rule-HTML-Section');
    expect(result.symbol.name).toBe('TestSection');
    expect(result.symbol.className).toBe('Work-Order');
    expect(result.symbol.ruleType).toBe('Rule-HTML-Section');
    expect(result.symbol.isRule).toBe(true);
    expect(result.symbol.ruleset).toBeUndefined();
  });

  it('extracts When-rule dependencies from layout fields', () => {
    const json = sectionJson({
      pyLayouts: [
        {
          type: 'dynamic',
          fields: [{ name: 'ConditionalField', when: '.Status = "Open"' }],
          when: 'SomeWhenRule',
        },
      ],
    });
    const result = parser.parse(json);
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
    const whenDeps = result.dependencies.filter((d) => d.ruleType === 'Rule-Declare-When');
    expect(whenDeps.length).toBeGreaterThanOrEqual(1);
  });

  it('handles missing pyLayouts gracefully', () => {
    const json = sectionJson({ pyLayouts: undefined });
    const section = parser.parseSection(json);
    expect(section.pyLayouts).toEqual([]);
    expect(section.pyFields).toHaveLength(1);
  });

  it('handles missing pyFields gracefully', () => {
    const json = sectionJson({ pyFields: undefined });
    const section = parser.parseSection(json);
    expect(section.pyLayouts).toHaveLength(1);
    expect(section.pyFields).toEqual([]);
  });

  it('performs round-trip: parse -> section -> PegaSectionRenderer renders HTML', () => {
    const json = sectionJson({
      pyLayouts: [
        {
          type: 'dynamic',
          fields: [
            { name: 'CustomerName', label: 'Customer Name', type: 'Text', value: 'John Doe' },
          ],
        },
      ],
      pyFields: [],
      pyWhen: '.Status = "Open"',
    });
    const section = parser.parseSection(json);
    expect(section.pyWhen).toBe('.Status = "Open"');
    const pegaSection = parser.sectionToPegaFormat(section);
    expect(pegaSection.name).toBe(section.pyName);
    const renderer = new PegaSectionRenderer();
    const context = createContext();
    const html = renderer.renderSection(pegaSection, context);
    expect(html).toContain('Customer Name (Text)');
    expect(html).toContain('John Doe');
  });
});
