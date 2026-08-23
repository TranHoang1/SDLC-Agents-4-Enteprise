/**
 * SA4E-191 — Shared adapter utilities (timeout + degrade gracefully).
 * Thin wrapper helpers used by the three SA4E-* adapters so engine calls
 * fail fast with a typed error when the upstream engine is absent.
 */

export class DependencyUnavailableError extends Error {
  constructor(public readonly engine: string, message?: string) {
    super(message ?? `${engine} is unavailable`);
    this.name = 'DependencyUnavailableError';
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${ms}ms exceeded`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}
