export interface AccessGroup {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  pyOrganization?: string;
  pyDivision?: string;
  pyRoleList?: string[];
  pyAccessRoleList?: AccessRoleRef[];
}

export interface AccessRoleRef {
  pyRoleName: string;
  pyPrivileges?: string[];
}

export interface AccessRole {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  pyPrivileges?: PrivilegeRef[];
  pyClasses?: string[];
  pyAccessGroup?: string;
}

export interface PrivilegeRef {
  pyPrivilegeName: string;
  pyActions?: string[];
}

export interface Privilege {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  pyActions?: string[];
  pyAccessGroup?: string;
  pyClassName?: string;
}

export interface OperatorID {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  pyAccessGroupName?: string;
  pyOrgDivision?: string;
  pyOrgUnit?: string;
  pyLanguage?: string;
  pyOrganization?: string;
}

export interface OrgDivision {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
}

export interface OrgUnit {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  pyDivisionName?: string;
}

export interface SecurityVA {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  pyEventType?: string;
  pyEventCategory?: string;
  pySeverity?: string;
  pyTargetClass?: string;
}

export type AccessRuleType =
  | 'Rule-Access-'
  | 'Rule-Access-Deny-'
  | 'Rule-Access-Deny-Obj'
  | 'Rule-Access-Privilege'
  | 'Rule-Access-Role-'
  | 'Rule-Access-Role-Name'
  | 'Rule-Access-Role-Obj'
  | 'Rule-Access-Setting'
  | 'Rule-Access-When';

export type AdminRuleType =
  | 'Rule-Admin-'
  | 'Rule-Admin-Extract'
  | 'Rule-Admin-Product'
  | 'Rule-Admin-Skill'
  | 'Rule-Admin-System'
  | 'Rule-Admin-System-Settings';
