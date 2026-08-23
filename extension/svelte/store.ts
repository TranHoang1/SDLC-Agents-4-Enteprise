/**
 * Minimal mock implementation of Svelte's writable and derived stores for test environment.
 * Provides just enough functionality for the extension's unit tests.
 */

export function writable<T>(initialValue: T) {
  let value = initialValue;
  const subscribers: Array<(v: T) => void> = [];

  return {
    set(v: T) {
      value = v;
      subscribers.forEach((s) => s(value));
    },
    update(fn: (v: T) => T) {
      value = fn(value);
      subscribers.forEach((s) => s(value));
    },
    subscribe(run: (v: T) => void) {
      run(value);
      subscribers.push(run);
      return () => {
        const i = subscribers.indexOf(run);
        if (i !== -1) subscribers.splice(i, 1);
      };
    },
    // expose current value for debugging (optional)
    get value() {
      return value;
    },
  } as any;
}

export function derived<T, R>(store: { subscribe: (run: (v: T) => void) => () => void }, fn: (value: T) => R) {
  return {
    subscribe(run: (v: R) => void) {
      const unsubscribe = store.subscribe((v: T) => {
        run(fn(v));
      });
      return unsubscribe;
    },
  } as any;
}
