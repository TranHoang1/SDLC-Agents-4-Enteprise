/**
 * PegaObject — Lớp trừu tượng gốc (Abstract Base Class) cho mọi đối tượng Pega Platform.
 * Áp dụng các nguyên lý OOP: Abstraction, Encapsulation, Polymorphism.
 */

export abstract class PegaObject {
  constructor(
    public readonly pxObjClass: string,
    public readonly pyInsKey?: string,
    public readonly updateDateTime?: string,
  ) {}

  public abstract getFqn(): string;
  public abstract isRule(): boolean;
  public abstract toCanonicalJson(): Record<string, unknown>;
}
