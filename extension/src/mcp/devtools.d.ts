/**
 * Ambient declarations for pre-built devtools ESM modules.
 * These modules are compiled JS — we skip type-checking and use `any`.
 */

declare module "./devtools/tools/tools.js" {
  export function createTools(args: any): any[];
}

declare module "./devtools/McpContext.js" {
  export class McpContext {
    static from(browser: any, logger: any, opts: any): Promise<McpContext>;
    browser: any;
    detectOpenDevToolsWindows(): Promise<void>;
    getSelectedMcpPage(): any;
    getPageById(id: number): any;
    setRoots(roots: any[]): void;
    dispose(): void;
  }
}

declare module "./devtools/McpResponse.js" {
  export class McpResponse {
    constructor(args: any);
    error: any;
    setRedactNetworkHeaders(v: boolean): void;
    setPage(page: any): void;
    setError(err: any): void;
    handle(toolName: string, ctx: any): Promise<{ content: any[]; structuredContent?: any }>;
  }
}

declare module "./devtools/SlimMcpResponse.js" {
  export class SlimMcpResponse {
    constructor(args: any);
    error: any;
    setRedactNetworkHeaders(v: boolean): void;
    setPage(page: any): void;
    setError(err: any): void;
    handle(toolName: string, ctx: any): Promise<{ content: any[]; structuredContent?: any }>;
  }
}

declare module "./devtools/Mutex.js" {
  export class Mutex {
    acquire(): Promise<{ dispose(): void }>;
  }
}

declare module "./devtools/browser.js" {
  export type Channel = "stable" | "beta" | "dev" | "canary";
  export function ensureBrowserLaunched(opts: any): Promise<any>;
  export function ensureBrowserConnected(opts: any): Promise<any>;
}

declare module "./devtools/issue-descriptions.js" {
  export function loadIssueDescriptions(): Promise<void>;
}

declare module "./devtools/logger.js" {
  export function logger(...args: any[]): void;
}
