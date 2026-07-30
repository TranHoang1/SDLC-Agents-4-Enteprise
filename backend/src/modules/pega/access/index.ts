export { PegaAccessParser } from './PegaAccessParser.js';
export type {
  AccessGroup,
  AccessRole,
  AccessRoleRef,
  Privilege,
  PrivilegeRef,
  OperatorID,
  OrgDivision,
  OrgUnit,
  SecurityVA,
  AccessRuleType,
  AdminRuleType,
} from './PegaAccessTypes.js';

import { PegaAccessParser } from './PegaAccessParser.js';
import { PegaParserRegistry } from '../strategies/PegaParserRegistry.js';

export function registerAccessParsers(registry: PegaParserRegistry): void {
  registry.registerStrategy(new PegaAccessParser());
}
