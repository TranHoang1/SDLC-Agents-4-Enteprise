"use strict";
/**
 * Minimal mock implementation of Svelte's writable and derived stores for test environment.
 * Provides just enough functionality for the extension's unit tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writable = writable;
exports.derived = derived;
function writable(initialValue) {
    let value = initialValue;
    const subscribers = [];
    return {
        set(v) {
            value = v;
            subscribers.forEach((s) => s(value));
        },
        update(fn) {
            value = fn(value);
            subscribers.forEach((s) => s(value));
        },
        subscribe(run) {
            run(value);
            subscribers.push(run);
            return () => {
                const i = subscribers.indexOf(run);
                if (i !== -1)
                    subscribers.splice(i, 1);
            };
        },
        // expose current value for debugging (optional)
        get value() {
            return value;
        },
    };
}
function derived(store, fn) {
    return {
        subscribe(run) {
            const unsubscribe = store.subscribe((v) => {
                run(fn(v));
            });
            return unsubscribe;
        },
    };
}
//# sourceMappingURL=store.js.map