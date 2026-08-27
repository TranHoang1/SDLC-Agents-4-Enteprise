/**
 * SA4E-223 — detectMetaType for Salesforce `*-meta.xml` files.
 * Single source of truth for the 17 supported compound suffixes.
 */

/** Ordered list of `<type>-meta.xml` suffixes (longest/most-specific first is not required; endsWith logic). */
export const META_SUFFIXES: string[] = [
  'flow', 'object', 'field', 'js', 'component',
  'flexipage', 'permissionset', 'profile', 'labels', 'tab', 'layout',
  'report', 'dashboard', 'site', 'resource', 'email', 'testSuite',
];

export function detectMetaType(filePath: string): string | null {
  const n = filePath.replace(/\\/g, '/').toLowerCase();
  if (n.endsWith('.flow-meta.xml')) return 'flow';
  if (n.endsWith('.object-meta.xml')) return 'object';
  if (n.endsWith('.field-meta.xml')) return 'field';
  if (n.endsWith('.js-meta.xml')) return 'lwc-meta';
  if (n.endsWith('.component-meta.xml')) return 'aura-meta';
  // ---- SA4E-223: 12 new meta types ----
  if (n.endsWith('.flexipage-meta.xml')) return 'flexipage';
  if (n.endsWith('.permissionset-meta.xml')) return 'permissionset';
  if (n.endsWith('.profile-meta.xml')) return 'profile';
  if (n.endsWith('.labels-meta.xml')) return 'labels';
  if (n.endsWith('.tab-meta.xml')) return 'tab';
  if (n.endsWith('.layout-meta.xml')) return 'layout';
  if (n.endsWith('.report-meta.xml')) return 'report';
  if (n.endsWith('.dashboard-meta.xml')) return 'dashboard';
  if (n.endsWith('.site-meta.xml')) return 'site';
  if (n.endsWith('.resource-meta.xml')) return 'resource';
  if (n.endsWith('.email-meta.xml')) return 'email';
  if (n.endsWith('.testsuite-meta.xml')) return 'testSuite';
  return null;
}
