/**
 * Deep-stub shim for chrome-devtools-frontend/mcp/mcp.js
 * Returns Proxy objects for any accessed property — allows devtools-mcp
 * to load without the full DevTools frontend.
 *
 * Performance tracing and DevTools debugging features will return empty data.
 * Core automation tools (click, navigate, screenshot, etc.) work without them.
 */

function createDeepStub(name = 'DevToolsStub') {
  const handler = {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => `[Stub ${name}]`;
      if (prop === Symbol.iterator) return undefined;
      if (prop === 'then') return undefined;
      if (prop === 'prototype') return Object.prototype;
      if (prop === 'instance') return () => createStubInstance();
      return createDeepStub(`${name}.${String(prop)}`);
    },
    apply() { return createStubInstance(); },
    construct() { return createStubInstance(); },
    set() { return true; },
    has() { return true; },
  };
  function createStubInstance() {
    return new Proxy({}, {
      get(t, p) {
        if (p === Symbol.toPrimitive) return () => '';
        if (p === 'toString') return () => `[StubInstance]`;
        if (p === 'then') return undefined;
        if (p === Symbol.iterator) return undefined;
        return createDeepStub(`${name}.instance.${String(p)}`);
      },
      set() { return true; },
    });
  }
  return new Proxy(function(){}, handler);
}

export const TraceEngine = createDeepStub('TraceEngine');
export const PerformanceTraceFormatter = createDeepStub('PerformanceTraceFormatter');
export const AgentFocus = createDeepStub('AgentFocus');
export const IssueDescription = createDeepStub('IssueDescription');
export const CSSOverview = createDeepStub('CSSOverview');
export const Common = createDeepStub('Common');
export const ProtocolClient = createDeepStub('ProtocolClient');
export const I18n = createDeepStub('I18n');
export const Formatter = createDeepStub('Formatter');
export const Foundation = createDeepStub('Foundation');
export const DebuggerModel = createDeepStub('DebuggerModel');
export const TargetManager = createDeepStub('TargetManager');

const DevToolsProxy = createDeepStub('DevTools');
export default DevToolsProxy;
