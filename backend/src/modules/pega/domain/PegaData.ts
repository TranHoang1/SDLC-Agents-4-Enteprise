/**
 * PegaData — Lớp trừu tượng cha cho tất cả các đối tượng Data (kế thừa Data-).
 */

import { PegaObject } from './PegaObject.js';

export class PegaData extends PegaObject {
  constructor(
    pxObjClass: string,
    public readonly keyIdentifier: string,
    public readonly rawJson: Record<string, unknown>,
    pyInsKey?: string,
  ) {
    super(pxObjClass, pyInsKey);
  }

  public isRule(): boolean {
    return false;
  }

  public getFqn(): string {
    return `${this.pxObjClass}:${this.keyIdentifier}`;
  }

  public toCanonicalJson(): Record<string, unknown> {
    return {
      pxObjClass: this.pxObjClass,
      keyIdentifier: this.keyIdentifier,
      fqn: this.getFqn(),
      ...this.rawJson,
    };
  }
}
