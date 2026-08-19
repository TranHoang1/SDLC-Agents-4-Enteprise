/**
 * DevTools MCP Bridge — registers chrome-devtools-mcp tools as local tools
 * running in-process within the extension.
 *
 * Uses dynamic import() to load ESM devtools modules from CJS extension context.
 * Tools are prefixed with "devtools_" and registered as hidden local tools
 * (discoverable via find_tools, callable via execute_dynamic_tool).
 */

import { registerLocalTool, type LocalToolDefinition } from "../backend-local-tools";

/**
 * Register all devtools MCP tools into the extension's local tool registry.
 * Call this once during extension activation.
 *
 * @param overrides - Optional config overrides (e.g., browserUrl for existing Chrome)
 */
export async function registerDevtoolsTools(
  overrides?: Record<string, unknown>
): Promise<number> {
  const DEFAULT_SERVER_ARGS: Record<string, unknown> = {
    headless: true,
    slim: false,
    isolated: true,
    usageStatistics: false,
    performanceCrux: false,
    redactNetworkHeaders: false,
    categoryEmulation: true,
    categoryPerformance: true,
    categoryNetwork: true,
    categoryExtensions: false,
    categoryExperimentalThirdParty: false,
    categoryExperimentalWebmcp: false,
    experimentalVision: false,
    experimentalScreencast: false,
    experimentalDevtools: false,
    experimentalPageIdRouting: false,
    experimentalStructuredContent: false,
    experimentalIncludeAllPages: false,
    viaCli: false,
    channel: "stable",
    chromeArg: [],
    ignoreDefaultChromeArg: [],
    autoConnect: false,
    acceptInsecureCerts: false,
    ...overrides,
  };

  // Dynamic import for ESM modules from CJS context
  // @ts-ignore — pre-built JS modules without declarations
  const [
    { createTools },
    { McpContext },
    { McpResponse },
    { SlimMcpResponse },
    { Mutex },
    { ensureBrowserLaunched, ensureBrowserConnected },
    { loadIssueDescriptions },
    { logger },
  ] = await Promise.all([
    // @ts-ignore
    import("./devtools/tools/tools.js"),
    // @ts-ignore
    import("./devtools/McpContext.js"),
    // @ts-ignore
    import("./devtools/McpResponse.js"),
    // @ts-ignore
    import("./devtools/SlimMcpResponse.js"),
    // @ts-ignore
    import("./devtools/Mutex.js"),
    // @ts-ignore
    import("./devtools/browser.js"),
    // @ts-ignore
    import("./devtools/issue-descriptions.js"),
    // @ts-ignore
    import("./devtools/logger.js"),
  ]);

  await loadIssueDescriptions();

  let context: any = null;
  const toolMutex = new Mutex();

  /** Lazy-initialize browser context on first tool call. */
  async function getContext(): Promise<any> {
    if (context) return context;
    const args = DEFAULT_SERVER_ARGS;
    const chromeArgs: string[] = ((args.chromeArg as string[]) ?? []).map(String);
    if (args.proxyServer) chromeArgs.push(`--proxy-server=${args.proxyServer}`);

    const browser = args.browserUrl || args.wsEndpoint || args.autoConnect
      ? await ensureBrowserConnected({
          browserURL: args.browserUrl,
          wsEndpoint: args.wsEndpoint,
          wsHeaders: args.wsHeaders,
          channel: args.autoConnect ? args.channel : undefined,
          userDataDir: args.userDataDir,
          devtools: args.experimentalDevtools ?? false,
        })
      : await ensureBrowserLaunched({
          headless: args.headless,
          executablePath: args.executablePath,
          channel: args.channel,
          isolated: args.isolated ?? false,
          userDataDir: args.userDataDir,
          logFile: undefined,
          viewport: args.viewport,
          chromeArgs,
          ignoreDefaultChromeArgs: ((args.ignoreDefaultChromeArg as string[]) ?? []).map(String),
          acceptInsecureCerts: args.acceptInsecureCerts,
          devtools: args.experimentalDevtools ?? false,
          enableExtensions: args.categoryExtensions,
          viaCli: false,
        });

    context = await McpContext.from(browser, logger, {
      experimentalDevToolsDebugging: args.experimentalDevtools ?? false,
      experimentalIncludeAllPages: args.experimentalIncludeAllPages,
      performanceCrux: args.performanceCrux,
    });
    return context;
  }

  const tools = createTools(DEFAULT_SERVER_ARGS);
  let registered = 0;

  for (const tool of tools) {
    const toolName = `devtools_${tool.name}`;

    const handler = async (params: Record<string, unknown>): Promise<any> => {
      const guard = await toolMutex.acquire();
      try {
        const ctx = await getContext();
        await ctx.detectOpenDevToolsWindows();
        const response = DEFAULT_SERVER_ARGS.slim
          ? new SlimMcpResponse(DEFAULT_SERVER_ARGS)
          : new McpResponse(DEFAULT_SERVER_ARGS);
        response.setRedactNetworkHeaders(DEFAULT_SERVER_ARGS.redactNetworkHeaders);

        try {
          const page = ctx.getSelectedMcpPage();
          response.setPage(page);
          if (tool.blockedByDialog) page.throwIfDialogOpen();
          if ("pageScoped" in tool && tool.pageScoped) {
            await tool.handler({ params, page }, response, ctx);
          } else {
            await tool.handler({ params } as any, response, ctx);
          }
        } catch (err: any) {
          response.setError(err);
        }

        const { content } = await response.handle(tool.name, ctx);
        return { isError: !!response.error, content };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `DevTools error: ${err.message || err}` }],
        };
      } finally {
        guard.dispose();
      }
    };

    const definition: LocalToolDefinition = {
      name: toolName,
      description: tool.description,
      inputSchema: (tool.schema || { type: "object", properties: {} }) as Record<string, unknown>,
      hidden: true,
    };

    registerLocalTool(toolName, handler, definition);
    registered++;
  }

  console.log(`[DevTools Bridge] Registered ${registered} tools (hidden, use find_tools to discover)`);
  return registered;
}

/**
 * Disconnect browser and clean up resources.
 */
export async function disposeDevtools(): Promise<void> {
  try {
    // @ts-ignore
    const { McpContext } = await import("./devtools/McpContext.js");
    // Context cleanup handled internally by browser close
  } catch {
    // Non-fatal
  }
}
