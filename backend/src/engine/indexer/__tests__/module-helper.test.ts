/**
 * SA4E-223 — Unit tests for detectModule segment-based Salesforce module mapping.
 */
import { describe, it, expect } from 'vitest';
import { detectModule } from '../module-helper.js';

describe('detectModule (SA4E-223)', () => {
  it('MH-1: pages/*.page -> visualforce-pages', () => {
    expect(detectModule('force-app/main/default/pages/X.page')).toBe('visualforce-pages');
  });

  it('MH-2: components/*.component (VF) -> visualforce-components', () => {
    expect(detectModule('force-app/main/default/components/X.component')).toBe('visualforce-components');
  });

  it('MH-3: layouts/*.layout-meta.xml -> sf-layouts', () => {
    expect(detectModule('force-app/main/default/layouts/X.layout-meta.xml')).toBe('sf-layouts');
  });

  it('MH-4: testSuites/*.testSuite-meta.xml -> sf-testsuites', () => {
    expect(detectModule('force-app/main/default/testSuites/X.testSuite-meta.xml')).toBe('sf-testsuites');
  });

  it('MH-5: aura/*.cmp -> aura-components', () => {
    expect(detectModule('force-app/main/default/aura/X.cmp')).toBe('aura-components');
  });

  it('MH-6: generic src/ segment checks before force-app default', () => {
    expect(detectModule('src/layouts/X.layout-meta.xml')).toBe('sf-layouts');
    expect(detectModule('src/pages/X.page')).toBe('visualforce-pages');
  });

  it('MH-7: unknown -> salesforce default', () => {
    expect(detectModule('force-app/main/default/unknown/X.xyz')).toBe('salesforce');
  });

  it('maps all new metadata segments', () => {
    const cases: [string, string][] = [
      ['force-app/.../permissionsets/X.permissionset-meta.xml', 'sf-permissionsets'],
      ['force-app/.../profiles/X.profile-meta.xml', 'sf-profiles'],
      ['force-app/.../tabs/X.tab-meta.xml', 'sf-tabs'],
      ['force-app/.../flexipages/X.flexipage-meta.xml', 'sf-flexipages'],
      ['force-app/.../labels/X.labels-meta.xml', 'sf-labels'],
      ['force-app/.../reports/X.report-meta.xml', 'sf-reports'],
      ['force-app/.../dashboards/X.dashboard-meta.xml', 'sf-dashboards'],
      ['force-app/.../sites/X.site-meta.xml', 'sf-sites'],
      ['force-app/.../staticresources/X.resource-meta.xml', 'sf-staticresources'],
      ['force-app/.../email/X.email-meta.xml', 'sf-email'],
    ];
    for (const [p, expected] of cases) {
      expect(detectModule(p)).toBe(expected);
    }
  });
});
