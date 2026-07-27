import { describe, it, expect } from 'vitest';
import { PegaAccessParser } from '../../access/PegaAccessParser.js';
import { PegaParserRegistry } from '../../strategies/PegaParserRegistry.js';
import { registerAccessParsers } from '../../access/index.js';

describe('PegaAccessParser', () => {
  const parser = new PegaAccessParser();

  // ─── AccessGroup parsing ────────────────────────────────────────────

  describe('AccessGroup parsing', () => {
    it('parses AccessGroup with roles from pyUserRoles', () => {
      const json = {
        pxObjClass: 'Data-Admin-AccessGroup',
        pyAccessGroup: 'JiraDevelopers',
        pyLabel: 'Jira Developers Access',
        pyOrganization: 'PegaSystems',
        pyDivision: 'Engineering',
        pyUserRoles: [
          { pyRoleName: 'Developer' },
          { pyRoleName: 'Tester' },
          { pyRoleName: 'Admin' },
        ],
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('JiraDevelopers');
      expect(result.symbol.ruleType).toBe('Data-Admin-AccessGroup');

      const typed = parser.parseAccessGroup(json);
      expect(typed.pyName).toBe('JiraDevelopers');
      expect(typed.pyOrganization).toBe('PegaSystems');
      expect(typed.pyDivision).toBe('Engineering');
      expect(typed.pyRoleList).toEqual(['Developer', 'Tester', 'Admin']);
      expect(typed.pyAccessRoleList).toBeUndefined();
    });

    it('parses AccessGroup with access role references', () => {
      const json = {
        pxObjClass: 'Data-Admin-AccessGroup',
        pyAccessGroup: 'Managers',
        pyOrganization: 'PegaSystems',
        pyAccessRoles: [
          { pyRoleName: 'ManagerRole', pyPrivileges: ['ApproveExpense', 'HireEmployee'] },
          { pyRoleName: 'ReadOnlyRole' },
        ],
      };

      const typed = parser.parseAccessGroup(json);
      expect(typed.pyAccessRoleList).toHaveLength(2);
      expect(typed.pyAccessRoleList![0].pyRoleName).toBe('ManagerRole');
      expect(typed.pyAccessRoleList![0].pyPrivileges).toEqual(['ApproveExpense', 'HireEmployee']);
      expect(typed.pyAccessRoleList![1].pyRoleName).toBe('ReadOnlyRole');
      expect(typed.pyAccessRoleList![1].pyPrivileges).toBeUndefined();
    });

    it('handles AccessGroup with missing optional fields', () => {
      const json = {
        pxObjClass: 'Data-Admin-AccessGroup',
        pyAccessGroup: 'MinimalGroup',
      };

      const typed = parser.parseAccessGroup(json);
      expect(typed.pyName).toBe('MinimalGroup');
      expect(typed.pyOrganization).toBeUndefined();
      expect(typed.pyDivision).toBeUndefined();
      expect(typed.pyRoleList).toBeUndefined();
      expect(typed.pyAccessRoleList).toBeUndefined();
    });
  });

  // ─── AccessRole parsing with privileges ─────────────────────────────

  describe('AccessRole parsing with privileges', () => {
    it('parses AccessRole with privilege refs and classes', () => {
      const json = {
        pxObjClass: 'Rule-Access-Role-Name',
        pyAccessRole: 'SeniorDev',
        pyLabel: 'Senior Developer Role',
        pyPrivileges: [
          { pyPrivilegeName: 'CodeAccess', pyActions: ['read', 'write'] },
          { pyPrivilegeName: 'DeployAccess', pyActions: ['execute'] },
        ],
        pyAccessibleClasses: ['Work-Order', 'Work-Ticket', 'Data-Customer'],
        pyAccessGroup: 'JiraDevelopers',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('SeniorDev');
      expect(result.symbol.logicSummary).toContain('SeniorDev');
      expect(result.symbol.logicSummary).toContain('Privileges: 2');

      const typed = parser.parseAccessRole(json);
      expect(typed.pyName).toBe('SeniorDev');
      expect(typed.pyLabel).toBe('Senior Developer Role');
      expect(typed.pyPrivileges).toHaveLength(2);
      expect(typed.pyPrivileges![0].pyPrivilegeName).toBe('CodeAccess');
      expect(typed.pyPrivileges![0].pyActions).toEqual(['read', 'write']);
      expect(typed.pyPrivileges![1].pyPrivilegeName).toBe('DeployAccess');
      expect(typed.pyPrivileges![1].pyActions).toEqual(['execute']);
      expect(typed.pyClasses).toEqual(['Work-Order', 'Work-Ticket', 'Data-Customer']);
      expect(typed.pyAccessGroup).toBe('JiraDevelopers');
    });

    it('parses AccessRole with empty privileges', () => {
      const json = {
        pxObjClass: 'Rule-Access-Role-Name',
        pyAccessRole: 'NoPrivilegeRole',
      };

      const typed = parser.parseAccessRole(json);
      expect(typed.pyPrivileges).toBeUndefined();
      expect(typed.pyClasses).toBeUndefined();
      expect(typed.pyAccessGroup).toBeUndefined();
    });

    it('extracts AccessRole dependency from parse()', () => {
      const json = {
        pxObjClass: 'Rule-Access-Role-Name',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'ReviewerRole',
        pyAccessRole: 'Reviewer',
        pyPrivileges: [
          { pyPrivilegeName: 'ReadAccess' },
        ],
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('ReviewerRole');
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]).toEqual({
        ruleType: 'Rule-Access-Role-Name',
        className: '@baseclass',
        ruleName: 'Reviewer',
      });
    });
  });

  // ─── Privilege with actions ─────────────────────────────────────────

  describe('Privilege with actions', () => {
    it('parses Privilege with action list', () => {
      const json = {
        pxObjClass: 'Rule-Access-Privilege',
        pyPrivilegeName: 'FullControl',
        pyLabel: 'Full Control Privilege',
        pyActions: ['read', 'write', 'delete', 'execute'],
        pyAccessGroup: 'Admins',
        pyClassName: 'Work-Order',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('FullControl');

      const typed = parser.parsePrivilege(json);
      expect(typed.pyName).toBe('FullControl');
      expect(typed.pyLabel).toBe('Full Control Privilege');
      expect(typed.pyActions).toEqual(['read', 'write', 'delete', 'execute']);
      expect(typed.pyAccessGroup).toBe('Admins');
      expect(typed.pyClassName).toBe('Work-Order');
    });

    it('parses Privilege with no actions', () => {
      const json = {
        pxObjClass: 'Rule-Access-Privilege',
        pyPrivilegeName: 'ReadOnly',
      };

      const typed = parser.parsePrivilege(json);
      expect(typed.pyActions).toBeUndefined();
      expect(typed.pyAccessGroup).toBeUndefined();
    });

    it('handles empty action array', () => {
      const json = {
        pxObjClass: 'Rule-Access-Privilege',
        pyPrivilegeName: 'EmptyActions',
        pyActions: [],
      };

      const typed = parser.parsePrivilege(json);
      expect(typed.pyActions).toBeUndefined();
    });
  });

  // ─── OperatorID with org references ──────────────────────────────────

  describe('OperatorID with org references', () => {
    it('parses OperatorID with org division and org unit', () => {
      const json = {
        pxObjClass: 'Data-Admin-Operator-ID',
        pyUserIdentifier: 'john.doe',
        pyUserName: 'John Doe',
        pyAccessGroup: 'JiraDevelopers',
        pyOrganization: 'PegaSystems',
        pyDivision: 'Engineering',
        pyUnit: 'PlatformTeam',
        pyLanguage: 'en_US',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('john.doe');

      const typed = parser.parseOperatorID(json);
      expect(typed.pyName).toBe('john.doe');
      expect(typed.pyLabel).toBe('John Doe');
      expect(typed.pyAccessGroupName).toBe('JiraDevelopers');
      expect(typed.pyOrgDivision).toBe('Engineering');
      expect(typed.pyOrgUnit).toBe('PlatformTeam');
      expect(typed.pyLanguage).toBe('en_US');
      expect(typed.pyOrganization).toBe('PegaSystems');
    });

    it('extracts AccessGroup dependency from OperatorID', () => {
      const json = {
        pxObjClass: 'Data-Admin-Operator-ID',
        pyUserIdentifier: 'jane.doe',
        pyUserName: 'Jane Doe',
        pyAccessGroup: 'Managers',
        pyOrganization: 'PegaSystems',
      };

      const result = parser.parse(json);
      const agDeps = result.dependencies.filter(d => d.ruleType === 'Data-Admin-AccessGroup');
      expect(agDeps).toHaveLength(1);
      expect(agDeps[0].ruleName).toBe('Managers');
    });

    it('handles minimal OperatorID', () => {
      const json = {
        pxObjClass: 'Data-Admin-Operator-ID',
        pyUserIdentifier: 'minimal.user',
      };

      const typed = parser.parseOperatorID(json);
      expect(typed.pyName).toBe('minimal.user');
      expect(typed.pyAccessGroupName).toBeUndefined();
      expect(typed.pyOrgDivision).toBeUndefined();
      expect(typed.pyOrgUnit).toBeUndefined();
      expect(typed.pyLanguage).toBeUndefined();
    });
  });

  // ─── OrgDivision/OrgUnit hierarchy ───────────────────────────────────

  describe('OrgDivision/OrgUnit hierarchy', () => {
    it('parses OrgDivision with name and label', () => {
      const json = {
        pxObjClass: 'Data-Admin-OrgDivision',
        pyName: 'Engineering',
        pyLabel: 'Engineering Division',
      };

      const typed = parser.parseOrgDivision(json);
      expect(typed.pyName).toBe('Engineering');
      expect(typed.pyLabel).toBe('Engineering Division');
    });

    it('parses OrgUnit with division reference', () => {
      const json = {
        pxObjClass: 'Data-Admin-OrgUnit',
        pyName: 'PlatformTeam',
        pyLabel: 'Platform Engineering Team',
        pyDivisionName: 'Engineering',
      };

      const typed = parser.parseOrgUnit(json);
      expect(typed.pyName).toBe('PlatformTeam');
      expect(typed.pyLabel).toBe('Platform Engineering Team');
      expect(typed.pyDivisionName).toBe('Engineering');
    });

    it('links OrgUnit back to OrgDivision via pyDivisionName dependency', () => {
      const json = {
        pxObjClass: 'Data-Admin-OrgUnit',
        pyName: 'QATeam',
        pyDivisionName: 'QualityAssurance',
      };

      const typed = parser.parseOrgUnit(json);
      expect(typed.pyDivisionName).toBe('QualityAssurance');
    });
  });

  // ─── supports() for all Rule-Access-* and Rule-Admin-* ──────────────

  describe('supports() for all Rule-Access-* and Rule-Admin-* prefixes', () => {
    it('returns true for all Rule-Access-* concrete types', () => {
      expect(parser.supports('Rule-Access-')).toBe(true);
      expect(parser.supports('Rule-Access-Deny-')).toBe(true);
      expect(parser.supports('Rule-Access-Deny-Obj')).toBe(true);
      expect(parser.supports('Rule-Access-Privilege')).toBe(true);
      expect(parser.supports('Rule-Access-Role-')).toBe(true);
      expect(parser.supports('Rule-Access-Role-Name')).toBe(true);
      expect(parser.supports('Rule-Access-Role-Obj')).toBe(true);
      expect(parser.supports('Rule-Access-Setting')).toBe(true);
      expect(parser.supports('Rule-Access-When')).toBe(true);
    });

    it('returns true for all Rule-Admin-* concrete types', () => {
      expect(parser.supports('Rule-Admin-')).toBe(true);
      expect(parser.supports('Rule-Admin-Extract')).toBe(true);
      expect(parser.supports('Rule-Admin-Product')).toBe(true);
      expect(parser.supports('Rule-Admin-Skill')).toBe(true);
      expect(parser.supports('Rule-Admin-System')).toBe(true);
      expect(parser.supports('Rule-Admin-System-Settings')).toBe(true);
    });

    it('returns true for Data-Admin-AccessGroup and Data-Admin-Operator-ID', () => {
      expect(parser.supports('Data-Admin-AccessGroup')).toBe(true);
      expect(parser.supports('Data-Admin-Operator-ID')).toBe(true);
    });

    it('returns true for any Rule-Access-* prefix match', () => {
      expect(parser.supports('Rule-Access-Custom')).toBe(true);
      expect(parser.supports('Rule-Access-NewFeature')).toBe(true);
    });

    it('returns true for any Rule-Admin-* prefix match', () => {
      expect(parser.supports('Rule-Admin-Custom')).toBe(true);
    });

    it('returns false for unrelated rule types', () => {
      expect(parser.supports('Rule-Obj-Activity')).toBe(false);
      expect(parser.supports('Rule-Obj-Model')).toBe(false);
      expect(parser.supports('Rule-Connect-REST')).toBe(false);
      expect(parser.supports('Rule-Declare-Expressions')).toBe(false);
      expect(parser.supports('')).toBe(false);
    });
  });

  // ─── Round-trip serialize/deserialize ───────────────────────────────

  describe('Round-trip serialize/deserialize', () => {
    it('preserves field values for AccessGroup', () => {
      const json = {
        pxObjClass: 'Data-Admin-AccessGroup',
        pyAccessGroup: 'SupportTeam',
        pyLabel: 'Support Team Access',
        pyOrganization: 'PegaSystems',
        pyDivision: 'Support',
        pyUserRoles: [
          { pyRoleName: 'Agent' },
          { pyRoleName: 'Manager' },
        ],
      };

      const typed = parser.parseAccessGroup(json);
      expect(typed.pxObjClass).toBe('Data-Admin-AccessGroup');
      expect(typed.pyName).toBe('SupportTeam');
      expect(typed.pyOrganization).toBe('PegaSystems');
      expect(typed.pyDivision).toBe('Support');
      expect(typed.pyRoleList).toEqual(['Agent', 'Manager']);
    });

    it('preserves field values for AccessRole', () => {
      const json = {
        pxObjClass: 'Rule-Access-Role-Name',
        pyAccessRole: 'Auditor',
        pyLabel: 'Auditor Role',
        pyPrivileges: [
          { pyPrivilegeName: 'AuditLogAccess', pyActions: ['read'] },
        ],
        pyAccessibleClasses: ['Data-AuditLog'],
      };

      const typed = parser.parseAccessRole(json);
      expect(typed.pxObjClass).toBe('Rule-Access-Role-Name');
      expect(typed.pyName).toBe('Auditor');
      expect(typed.pyLabel).toBe('Auditor Role');
      expect(typed.pyPrivileges).toHaveLength(1);
      expect(typed.pyPrivileges![0].pyPrivilegeName).toBe('AuditLogAccess');
      expect(typed.pyClasses).toEqual(['Data-AuditLog']);
    });

    it('preserves field values for Privilege', () => {
      const json = {
        pxObjClass: 'Rule-Access-Privilege',
        pyPrivilegeName: 'ExportData',
        pyActions: ['export'],
        pyAccessGroup: 'ReportUsers',
      };

      const typed = parser.parsePrivilege(json);
      expect(typed.pxObjClass).toBe('Rule-Access-Privilege');
      expect(typed.pyName).toBe('ExportData');
      expect(typed.pyActions).toEqual(['export']);
      expect(typed.pyAccessGroup).toBe('ReportUsers');
    });

    it('preserves field values for OperatorID', () => {
      const json = {
        pxObjClass: 'Data-Admin-Operator-ID',
        pyUserIdentifier: 'ops.user',
        pyUserName: 'Ops User',
        pyAccessGroup: 'Operations',
        pyLanguage: 'de_DE',
      };

      const typed = parser.parseOperatorID(json);
      expect(typed.pxObjClass).toBe('Data-Admin-Operator-ID');
      expect(typed.pyName).toBe('ops.user');
      expect(typed.pyLabel).toBe('Ops User');
      expect(typed.pyAccessGroupName).toBe('Operations');
      expect(typed.pyLanguage).toBe('de_DE');
    });

    it('preserves field values for SecurityVA', () => {
      const json = {
        pxObjClass: 'Rule-Security-VA',
        pyRuleName: 'AuditLogin',
        pyLabel: 'Audit Login Events',
        pyEventType: 'Login',
        pyEventCategory: 'Authentication',
        pySeverity: 'High',
        pyTargetClass: 'Data-Admin-Operator-ID',
      };

      const typed = parser.parseSecurityVA(json);
      expect(typed.pxObjClass).toBe('Rule-Security-VA');
      expect(typed.pyName).toBe('AuditLogin');
      expect(typed.pyLabel).toBe('Audit Login Events');
      expect(typed.pyEventType).toBe('Login');
      expect(typed.pyEventCategory).toBe('Authentication');
      expect(typed.pySeverity).toBe('High');
      expect(typed.pyTargetClass).toBe('Data-Admin-Operator-ID');
    });
  });

  // ─── Missing optional fields ────────────────────────────────────────

  describe('Missing optional fields', () => {
    it('handles empty AccessGroup', () => {
      const json = { pxObjClass: 'Data-Admin-AccessGroup' };

      const typed = parser.parseAccessGroup(json);
      expect(typed.pyName).toBe('');
      expect(typed.pyOrganization).toBeUndefined();
      expect(typed.pyRoleList).toBeUndefined();
    });

    it('handles empty AccessRole', () => {
      const json = { pxObjClass: 'Rule-Access-Role-Name' };

      const typed = parser.parseAccessRole(json);
      expect(typed.pyName).toBe('');
      expect(typed.pyPrivileges).toBeUndefined();
      expect(typed.pyClasses).toBeUndefined();
    });

    it('handles empty Privilege', () => {
      const json = { pxObjClass: 'Rule-Access-Privilege' };

      const typed = parser.parsePrivilege(json);
      expect(typed.pyName).toBe('');
      expect(typed.pyActions).toBeUndefined();
    });

    it('handles empty OperatorID', () => {
      const json = { pxObjClass: 'Data-Admin-Operator-ID' };

      const typed = parser.parseOperatorID(json);
      expect(typed.pyName).toBe('');
      expect(typed.pyAccessGroupName).toBeUndefined();
      expect(typed.pyLanguage).toBeUndefined();
    });

    it('handles empty json for parse()', () => {
      const json = { pxObjClass: 'Rule-Access-Role-Name' };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('');
      expect(result.symbol.fqn).toBe('Rule-Access-Role-Name:@baseclass:');
      expect(result.dependencies).toHaveLength(0);
    });
  });

  // ─── Registry integration ────────────────────────────────────────────

  describe('Registry integration', () => {
    it('can be registered and used via PegaParserRegistry', () => {
      const registry = new PegaParserRegistry();
      registerAccessParsers(registry);

      const json = {
        pxObjClass: 'Data-Admin-AccessGroup',
        pyAccessGroup: 'DevTeam',
        pyOrganization: 'PegaSystems',
        pyUserRoles: [
          { pyRoleName: 'Developer' },
        ],
      };

      const result = registry.parse(json);
      expect(result.symbol.ruleType).toBe('Data-Admin-AccessGroup');
      expect(result.symbol.name).toBe('DevTeam');
    });

    it('registers before fallback so Access rules are handled first', () => {
      const registry = new PegaParserRegistry();
      registerAccessParsers(registry);

      const result = registry.parse({
        pxObjClass: 'Rule-Access-Privilege',
        pyPrivilegeName: 'TestPrivilege',
      });

      expect(result.symbol.ruleType).toBe('Rule-Access-Privilege');
      expect(result.symbol.name).toBe('TestPrivilege');
    });
  });
});
