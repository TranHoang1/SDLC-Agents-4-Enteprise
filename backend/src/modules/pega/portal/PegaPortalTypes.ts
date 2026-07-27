/**
 * PegaPortalTypes — Domain types for Pega UI/Portal Rules (Rule-HTML-*, Rule-Portal, Rule-Navigation).
 */

export type SectionType = 'Section' | 'Harness' | 'FlowAction';

export interface PortalLayout {
  type?: string;
  fields?: PortalField[];
  children?: PortalLayout[];
  properties?: Record<string, unknown>;
  visible?: boolean;
  when?: string;
}

export interface PortalField {
  name: string;
  label?: string;
  type?: string;
  value?: unknown;
  visible?: boolean;
  when?: string;
}

export interface Section {
  pyName: string;
  pyType: SectionType;
  pyLayouts: PortalLayout[];
  pyFields: PortalField[];
  pyWhen?: string;
}

export interface Harness {
  pyName: string;
  pyType: 'Harness';
  pyHeader?: Section;
  pyContent?: Section;
  pyFooter?: Section;
  pyPortal?: string;
  pySkin?: string;
}

export interface FlowAction {
  pyName: string;
  pyType: 'FlowAction';
  pyLayouts: PortalLayout[];
  pyFields: PortalField[];
}

export interface Portal {
  pyName: string;
  pyLabel?: string;
  pyPortals: string[];
  pySkins: string[];
}

export interface Skin {
  pyName: string;
  pyColors?: Record<string, string>;
  pyBackground?: string;
  pyFonts?: Record<string, string>;
}

export interface Navigation {
  pyName: string;
  pyMenuItems: NavMenuItem[];
}

export interface NavMenuItem {
  label: string;
  url?: string;
  icon?: string;
  children?: NavMenuItem[];
  when?: string;
}

export type PortalRule =
  | Section
  | Harness
  | FlowAction
  | Portal
  | Skin
  | Navigation;

export const PORTAL_RULE_CLASSES: string[] = [
  'Rule-HTML-Section',
  'Rule-HTML-Harness',
  'Rule-HTML-FlowAction',
  'Rule-Portal',
  'Rule-Portal-Skin',
  'Rule-Navigation',
];
