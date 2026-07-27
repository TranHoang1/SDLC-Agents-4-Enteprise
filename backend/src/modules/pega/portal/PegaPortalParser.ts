/**
 * PegaPortalParser — Parses Pega UI/Portal Rules into domain types compatible with PegaSectionRenderer.
 */

import type { IPegaRuleParserStrategy, ParseResult } from '../strategies/IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';
import type { PegaSection, PegaLayout, PegaField } from '../ui/PegaUITypes.js';
import type { LayoutType } from '../ui/PegaUITypes.js';
import {
  type Section,
  type Harness,
  type FlowAction,
  type Portal,
  type Skin,
  type Navigation,
  type NavMenuItem,
  type PortalLayout,
  type PortalField,
  type SectionType,
  PORTAL_RULE_CLASSES,
} from './PegaPortalTypes.js';

const LAYOUT_TYPE_MAP: Record<string, LayoutType> = {
  dynamic: 'dynamic',
  tab: 'tab',
  repeating: 'repeating',
  table: 'table',
};

export class PegaPortalParser implements IPegaRuleParserStrategy {
  public supports(pxObjClass: string): boolean {
    return PORTAL_RULE_CLASSES.includes(pxObjClass);
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || '';
    const className = (json.pyClassName as string) || (json.className as string) || '@baseclass';
    const name = (json.pyRuleName as string) || (json.pyLabel as string) || (json.pyName as string) || 'UnnamedPortal';
    const fqn = `${pxObjClass}:${className}:${name}`;

    const symbol = {
      fqn,
      name,
      className,
      ruleType: pxObjClass,
      isRule: pxObjClass.startsWith('Rule-'),
      ruleset: (json.pyRuleset as string) || undefined,
      version: (json.pyRulesetVersion as string) || undefined,
    };

    const dependencies = this.extractDependencies(json, pxObjClass);
    return { symbol, dependencies };
  }

  public parseSection(json: Record<string, unknown>): Section {
    const raw = json.pyLayouts as unknown[];
    return {
      pyName: (json.pyName as string) || (json.pyRuleName as string) || 'Unnamed',
      pyType: (json.pyType as SectionType) || this.inferSectionType(json),
      pyLayouts: Array.isArray(raw) ? raw.map((l) => this.convertLayout(l as Record<string, unknown>)) : [],
      pyFields: this.parseFields(json.pyFields as unknown[]),
      pyWhen: (json.pyWhen as string) || undefined,
    };
  }

  public sectionToPegaFormat(section: Section): PegaSection {
    return {
      name: section.pyName,
      layouts: section.pyLayouts.map((l) => this.portalLayoutToPegaLayout(l)),
      fields: section.pyFields.map((f) => this.portalFieldToPegaField(f)),
    };
  }

  public parseHarness(json: Record<string, unknown>): Harness {
    const parseSubSection = (key: string): Section | undefined => {
      const raw = json[key];
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return this.parseSection(raw as Record<string, unknown>);
      }
      return undefined;
    };

    return {
      pyName: (json.pyName as string) || (json.pyRuleName as string) || 'UnnamedHarness',
      pyType: 'Harness',
      pyHeader: parseSubSection('pyHeader'),
      pyContent: parseSubSection('pyContent'),
      pyFooter: parseSubSection('pyFooter'),
      pyPortal: (json.pyPortal as string) || undefined,
      pySkin: (json.pySkin as string) || undefined,
    };
  }

  public parseFlowAction(json: Record<string, unknown>): FlowAction {
    const raw = json.pyLayouts as unknown[];
    return {
      pyName: (json.pyName as string) || (json.pyRuleName as string) || 'UnnamedFlowAction',
      pyType: 'FlowAction',
      pyLayouts: Array.isArray(raw) ? raw.map((l) => this.convertLayout(l as Record<string, unknown>)) : [],
      pyFields: this.parseFields(json.pyFields as unknown[]),
    };
  }

  public parsePortal(json: Record<string, unknown>): Portal {
    return {
      pyName: (json.pyName as string) || (json.pyRuleName as string) || 'UnnamedPortal',
      pyLabel: (json.pyLabel as string) || undefined,
      pyPortals: this.asStringArray(json.pyPortals),
      pySkins: this.asStringArray(json.pySkins),
    };
  }

  public parseSkin(json: Record<string, unknown>): Skin {
    return {
      pyName: (json.pyName as string) || (json.pyRuleName as string) || 'UnnamedSkin',
      pyColors: json.pyColors ? { ...json.pyColors as Record<string, string> } : undefined,
      pyBackground: (json.pyBackground as string) || undefined,
      pyFonts: json.pyFonts ? { ...json.pyFonts as Record<string, string> } : undefined,
    };
  }

  public parseNavigation(json: Record<string, unknown>): Navigation {
    const raw = json.pyMenuItems as unknown[];
    return {
      pyName: (json.pyName as string) || (json.pyRuleName as string) || 'UnnamedNavigation',
      pyMenuItems: Array.isArray(raw) ? raw.map((m) => this.parseNavMenuItem(m as Record<string, unknown>)) : [],
    };
  }

  private parseNavMenuItem(raw: Record<string, unknown>): NavMenuItem {
    const childrenRaw = raw.children as unknown[];
    return {
      label: (raw.label as string) || (raw.pyLabel as string) || '',
      url: (raw.url as string) || undefined,
      icon: (raw.icon as string) || undefined,
      children: Array.isArray(childrenRaw)
        ? childrenRaw.map((c) => this.parseNavMenuItem(c as Record<string, unknown>))
        : undefined,
      when: (raw.when as string) || undefined,
    };
  }

  private parseFields(raw: unknown): PortalField[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((f) => this.convertField(f as Record<string, unknown>));
  }

  private convertField(raw: Record<string, unknown>): PortalField {
    return {
      name: (raw.name as string) || (raw.pyName as string) || (raw.pyPropertyName as string) || '',
      label: (raw.label as string) || (raw.pyLabel as string) || undefined,
      type: (raw.type as string) || (raw.pyType as string) || undefined,
      value: raw.value ?? raw.pyValue ?? undefined,
      visible: raw.visible !== undefined ? Boolean(raw.visible) : undefined,
      when: (raw.when as string) || (raw.pyWhen as string) || undefined,
    };
  }

  private convertLayout(raw: Record<string, unknown>): PortalLayout {
    const childrenRaw = raw.children as unknown[];
    const fieldsRaw = raw.fields as unknown[];
    return {
      type: (raw.type as string) || (raw.pyLayoutType as string) || undefined,
      fields: Array.isArray(fieldsRaw) ? fieldsRaw.map((f) => this.convertField(f as Record<string, unknown>)) : undefined,
      children: Array.isArray(childrenRaw)
        ? childrenRaw.map((c) => this.convertLayout(c as Record<string, unknown>))
        : undefined,
      properties: raw.properties ? { ...raw.properties as Record<string, unknown> } : undefined,
      visible: raw.visible !== undefined ? Boolean(raw.visible) : undefined,
      when: (raw.when as string) || (raw.pyWhen as string) || undefined,
    };
  }

  private portalLayoutToPegaLayout(layout: PortalLayout): PegaLayout {
    return {
      type: layout.type ? (LAYOUT_TYPE_MAP[layout.type] || 'dynamic') : undefined,
      fields: layout.fields?.map((f) => this.portalFieldToPegaField(f)),
      children: layout.children?.map((c) => this.portalLayoutToPegaLayout(c)),
      properties: layout.properties,
      visible: layout.visible,
      when: layout.when,
    };
  }

  private portalFieldToPegaField(field: PortalField): PegaField {
    return {
      name: field.name,
      label: field.label,
      type: field.type,
      value: field.value,
      visible: field.visible,
      when: field.when,
    };
  }

  private inferSectionType(json: Record<string, unknown>): SectionType {
    const cls = (json.pxObjClass as string) || '';
    if (cls === 'Rule-HTML-Harness') return 'Harness';
    if (cls === 'Rule-HTML-FlowAction') return 'FlowAction';
    return 'Section';
  }

  private extractDependencies(json: Record<string, unknown>, pxObjClass: string): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];

    if (pxObjClass === 'Rule-HTML-Section') {
      const layouts = Array.isArray(json.pyLayouts) ? (json.pyLayouts as Record<string, unknown>[]) : [];
      this.extractLayoutDeps(layouts, deps);
    }

    if (pxObjClass === 'Rule-HTML-Harness') {
      for (const key of ['pyHeader', 'pyContent', 'pyFooter']) {
        const sub = json[key];
        if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
          const sectionJson = sub as Record<string, unknown>;
          const subLayouts = Array.isArray(sectionJson.pyLayouts) ? (sectionJson.pyLayouts as Record<string, unknown>[]) : [];
          this.extractLayoutDeps(subLayouts, deps);
        }
      }
    }

    if (pxObjClass === 'Rule-HTML-FlowAction') {
      const layouts = Array.isArray(json.pyLayouts) ? (json.pyLayouts as Record<string, unknown>[]) : [];
      this.extractLayoutDeps(layouts, deps);
    }

    if (pxObjClass === 'Rule-Portal') {
      const portals = Array.isArray(json.pyPortals) ? (json.pyPortals as string[]) : [];
      for (const p of portals) {
        deps.push({ ruleType: 'Rule-Portal', className: '@baseclass', ruleName: p });
      }
    }

    if (pxObjClass === 'Rule-Portal-Skin') {
      const portalRef = json.pyPortal as string;
      if (portalRef) {
        deps.push({ ruleType: 'Rule-Portal', className: '@baseclass', ruleName: portalRef });
      }
    }

    return deps;
  }

  private extractLayoutDeps(layouts: Record<string, unknown>[], deps: UnresolvedDependency[]): void {
    for (const layout of layouts) {
      const when = (layout.when as string) || (layout.pyWhen as string);
      if (when && when.trim()) {
        deps.push({ ruleType: 'Rule-Declare-When', className: '@baseclass', ruleName: when.trim() });
      }
      const children = Array.isArray(layout.children) ? (layout.children as Record<string, unknown>[]) : [];
      if (children.length > 0) {
        this.extractLayoutDeps(children, deps);
      }
    }
  }

  private asStringArray(val: unknown): string[] {
    return Array.isArray(val) ? (val as string[]).filter((s) => typeof s === 'string') : [];
  }
}
