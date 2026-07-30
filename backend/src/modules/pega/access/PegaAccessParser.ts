import type { IPegaRuleParserStrategy, ParseResult } from '../strategies/IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';
import type {
  AccessGroup,
  AccessRole,
  AccessRoleRef,
  Privilege,
  PrivilegeRef,
  OperatorID,
  OrgDivision,
  OrgUnit,
  SecurityVA,
} from './PegaAccessTypes.js';

const ACCESS_AND_ADMIN_CLASSES = new Set([
  'Rule-Access-',
  'Rule-Access-Deny-',
  'Rule-Access-Deny-Obj',
  'Rule-Access-Privilege',
  'Rule-Access-Role-',
  'Rule-Access-Role-Name',
  'Rule-Access-Role-Obj',
  'Rule-Access-Setting',
  'Rule-Access-When',
  'Rule-Admin-',
  'Rule-Admin-Extract',
  'Rule-Admin-Product',
  'Rule-Admin-Skill',
  'Rule-Admin-System',
  'Rule-Admin-System-Settings',
]);

export class PegaAccessParser implements IPegaRuleParserStrategy {
  public supports(pxObjClass: string): boolean {
    if (ACCESS_AND_ADMIN_CLASSES.has(pxObjClass)) return true;
    if (pxObjClass === 'Data-Admin-AccessGroup') return true;
    if (pxObjClass === 'Data-Admin-Operator-ID') return true;
    if (pxObjClass.startsWith('Rule-Access-')) return true;
    if (pxObjClass.startsWith('Rule-Admin-')) return true;
    return false;
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || '';
    const className = (json.pyClassName as string) || '@baseclass';
    const name = this.extractName(pxObjClass, json);
    const fqn = `${pxObjClass}:${className}:${name}`;
    const dependencies = this.extractDependencies(json);

    const logicSummary = this.buildLogicSummary(pxObjClass, json);

    const symbol = {
      fqn,
      name,
      className,
      ruleType: pxObjClass,
      isRule: true,
      ruleset: (json.pyRuleset as string) || undefined,
      version: (json.pyRulesetVersion as string) || undefined,
      logicSummary,
    };

    return { symbol, dependencies };
  }

  private extractName(pxObjClass: string, json: Record<string, unknown>): string {
    return (json.pyRuleName as string)
      || (json.pyUserIdentifier as string)
      || (json.pyPrivilegeName as string)
      || (json.pyAccessRole as string)
      || (json.pyAccessGroup as string)
      || (json.pyName as string)
      || (json.pyLabel as string)
      || '';
  }

  public parseAccessGroup(json: Record<string, unknown>): AccessGroup {
    const roleList: string[] = [];
    const accessRoleList: AccessRoleRef[] = [];

    const rawRoles = json.pyUserRoles as unknown[];
    if (Array.isArray(rawRoles)) {
      for (const raw of rawRoles) {
        if (typeof raw !== 'object' || !raw) continue;
        const role = raw as Record<string, unknown>;
        const roleName = (role.pyRoleName as string) || '';
        if (roleName) roleList.push(roleName);
      }
    }

    const rawAccessRoles = json.pyAccessRoles as unknown[];
    if (Array.isArray(rawAccessRoles)) {
      for (const raw of rawAccessRoles) {
        if (typeof raw !== 'object' || !raw) continue;
        const ar = raw as Record<string, unknown>;
        const privs: string[] = [];
        const rawPrivs = ar.pyPrivileges as unknown[];
        if (Array.isArray(rawPrivs)) {
          for (const p of rawPrivs) {
            if (typeof p === 'string') privs.push(p);
          }
        }
        accessRoleList.push({
          pyRoleName: (ar.pyRoleName as string) || '',
          pyPrivileges: privs.length > 0 ? privs : undefined,
        });
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Data-Admin-AccessGroup',
      pyName: (json.pyAccessGroup as string) || this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
      pyOrganization: (json.pyOrganization as string) || undefined,
      pyDivision: (json.pyDivision as string) || undefined,
      pyRoleList: roleList.length > 0 ? roleList : undefined,
      pyAccessRoleList: accessRoleList.length > 0 ? accessRoleList : undefined,
    };
  }

  public parseAccessRole(json: Record<string, unknown>): AccessRole {
    const privileges: PrivilegeRef[] = [];
    const rawPrivs = json.pyPrivileges as unknown[];
    if (Array.isArray(rawPrivs)) {
      for (const raw of rawPrivs) {
        if (typeof raw !== 'object' || !raw) continue;
        const p = raw as Record<string, unknown>;
        const actions: string[] = [];
        const rawActions = p.pyActions as unknown[];
        if (Array.isArray(rawActions)) {
          for (const a of rawActions) {
            if (typeof a === 'string') actions.push(a);
          }
        }
        privileges.push({
          pyPrivilegeName: (p.pyPrivilegeName as string) || '',
          pyActions: actions.length > 0 ? actions : undefined,
        });
      }
    }

    const classes: string[] = [];
    const rawClasses = json.pyAccessibleClasses as unknown[];
    if (Array.isArray(rawClasses)) {
      for (const c of rawClasses) {
        if (typeof c === 'string') classes.push(c);
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Access-Role-Name',
      pyName: (json.pyAccessRole as string) || this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
      pyPrivileges: privileges.length > 0 ? privileges : undefined,
      pyClasses: classes.length > 0 ? classes : undefined,
      pyAccessGroup: (json.pyAccessGroup as string) || undefined,
    };
  }

  public parsePrivilege(json: Record<string, unknown>): Privilege {
    const actions: string[] = [];
    const rawActions = json.pyActions as unknown[];
    if (Array.isArray(rawActions)) {
      for (const a of rawActions) {
        if (typeof a === 'string') actions.push(a);
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Access-Privilege',
      pyName: (json.pyPrivilegeName as string) || this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
      pyActions: actions.length > 0 ? actions : undefined,
      pyAccessGroup: (json.pyAccessGroup as string) || undefined,
      pyClassName: (json.pyClassName as string) || undefined,
    };
  }

  public parseOperatorID(json: Record<string, unknown>): OperatorID {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Data-Admin-Operator-ID',
      pyName: (json.pyUserIdentifier as string) || this.extractName('', json),
      pyLabel: (json.pyUserName as string) || (json.pyLabel as string) || undefined,
      pyAccessGroupName: (json.pyAccessGroup as string) || undefined,
      pyOrgDivision: (json.pyDivision as string) || undefined,
      pyOrgUnit: (json.pyUnit as string) || undefined,
      pyLanguage: (json.pyLanguage as string) || undefined,
      pyOrganization: (json.pyOrganization as string) || undefined,
    };
  }

  public parseOrgDivision(json: Record<string, unknown>): OrgDivision {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Data-Admin-OrgDivision',
      pyName: (json.pyName as string) || (json.pyOrgDivision as string) || this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
    };
  }

  public parseOrgUnit(json: Record<string, unknown>): OrgUnit {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Data-Admin-OrgUnit',
      pyName: (json.pyName as string) || (json.pyOrgUnit as string) || this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
      pyDivisionName: (json.pyDivisionName as string) || (json.pyOrgDivision as string) || undefined,
    };
  }

  public parseSecurityVA(json: Record<string, unknown>): SecurityVA {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Security-VA',
      pyName: (json.pyRuleName as string) || this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
      pyEventType: (json.pyEventType as string) || undefined,
      pyEventCategory: (json.pyEventCategory as string) || undefined,
      pySeverity: (json.pySeverity as string) || undefined,
      pyTargetClass: (json.pyTargetClass as string) || (json.pyClassName as string) || undefined,
    };
  }

  private extractDependencies(json: Record<string, unknown>): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const className = (json.pyClassName as string) || '@baseclass';

    const accessGroup = (json.pyAccessGroup as string);
    if (accessGroup) {
      deps.push({ ruleType: 'Data-Admin-AccessGroup', className: '@baseclass', ruleName: accessGroup });
    }

    const accessRole = (json.pyAccessRole as string);
    if (accessRole) {
      deps.push({ ruleType: 'Rule-Access-Role-Name', className: '@baseclass', ruleName: accessRole });
    }

    const privilegeName = (json.pyPrivilegeName as string);
    if (privilegeName) {
      deps.push({ ruleType: 'Rule-Access-Privilege', className, ruleName: privilegeName });
    }

    const whenRef = (json.pyBlockName as string) || (json.pyWhenCondition as string);
    if (whenRef) {
      deps.push({ ruleType: 'Rule-Access-When', className, ruleName: whenRef });
    }

    return deps;
  }

  private buildLogicSummary(pxObjClass: string, json: Record<string, unknown>): string {
    const lines: string[] = [];
    lines.push(`${pxObjClass}: ${this.extractName(pxObjClass, json)}`);

    if (pxObjClass === 'Data-Admin-AccessGroup') {
      const roles = json.pyUserRoles as unknown[];
      lines.push(`  Organization: ${(json.pyOrganization as string) || '(not set)'}`);
      lines.push(`  Division: ${(json.pyDivision as string) || '(not set)'}`);
      lines.push(`  Roles: ${Array.isArray(roles) ? roles.length : 0}`);
    } else if (pxObjClass === 'Rule-Access-Role-Name') {
      const privs = json.pyPrivileges as unknown[];
      lines.push(`  Access Role: ${(json.pyAccessRole as string) || '(not set)'}`);
      lines.push(`  Privileges: ${Array.isArray(privs) ? privs.length : 0}`);
    } else if (pxObjClass === 'Rule-Access-Privilege') {
      const actions = json.pyActions as unknown[];
      lines.push(`  Privilege: ${(json.pyPrivilegeName as string) || '(not set)'}`);
      lines.push(`  Actions: ${Array.isArray(actions) ? actions.length : 0}`);
    } else if (pxObjClass === 'Data-Admin-Operator-ID') {
      lines.push(`  User: ${(json.pyUserIdentifier as string) || '(not set)'}`);
      lines.push(`  Access Group: ${(json.pyAccessGroup as string) || '(not set)'}`);
    } else if (pxObjClass.startsWith('Rule-Access-')) {
      const keyField = (json.pyAccessRole as string) || (json.pyPrivilegeName as string) || (json.pyBlockName as string) || '';
      if (keyField) lines.push(`  Key: ${keyField}`);
    } else if (pxObjClass.startsWith('Rule-Admin-')) {
      const desc = (json.pyDescription as string) || '';
      if (desc) lines.push(`  Description: ${desc}`);
    }

    return lines.join('\n');
  }
}
