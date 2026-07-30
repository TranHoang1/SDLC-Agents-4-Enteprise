/**
 * PegaObjectFactory — Áp dụng Design Pattern: Factory Pattern.
 * Tự động khởi tạo đối tượng OOP PegaObject cụ thể từ JSON Pega dựa trên pxObjClass.
 */

import { PegaObject } from './PegaObject.js';
import { PegaActivityRule } from './PegaActivityRule.js';
import { PegaDataTransformRule } from './PegaDataTransformRule.js';
import { PegaGenericRule } from './PegaGenericRule.js';
import { PegaData } from './PegaData.js';
import type { PegaRuleKbSchema } from '../strategies/KbDrivenPegaParserStrategy.js';

export class PegaObjectFactory {
  public static create(json: Record<string, unknown>, schema?: PegaRuleKbSchema): PegaObject {
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Obj-Activity';
    const isRule = pxObjClass.startsWith('Rule-');

    if (!isRule) {
      const keyId = (json.pyUserIdentifier as string) || (json.pyAccessGroup as string) || (json.pyInsKey as string) || 'DataInstance';
      return new PegaData(pxObjClass, keyId, json);
    }

    const className = (json.pyClassName as string) || (json.className as string) || '@baseclass';
    const ruleset = (json.pyRuleset as string) || undefined;
    const version = (json.pyRulesetVersion as string) || undefined;

    if (pxObjClass === 'Rule-Obj-Activity') {
      const name = (json.pyActivityName as string) || (json.pyLabel as string) || 'UnnamedActivity';
      return new PegaActivityRule(className, name, json, ruleset, version);
    }

    if (pxObjClass === 'Rule-Obj-Model') {
      const name = (json.pyModelName as string) || (json.pyTransformName as string) || (json.pyLabel as string) || 'UnnamedTransform';
      return new PegaDataTransformRule(className, name, json, ruleset, version);
    }

    const nameProp = schema?.nameProperty || 'pyLabel';
    const genericName = (json[nameProp] as string) || (json.pyRuleName as string) || (json.pyLabel as string) || 'UnnamedRule';
    return new PegaGenericRule(pxObjClass, className, genericName, json, schema, ruleset, version);
  }
}
