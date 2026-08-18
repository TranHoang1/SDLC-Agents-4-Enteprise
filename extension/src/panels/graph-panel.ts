/**
 * GraphPanel — KB Graph viewer via iframe (shared viewer on MCP port).
 * Uses same viewer as browser (http://localhost:PORT/) for consistent results.
 */

import * as vscode from "vscode";
import { WebviewToExtMessage } from "../types";
import { IServerManager } from "../types/server-types";
import { BasePanel } from "./base-panel";
import { getBackendUrl } from "../config/backend-url";

/** System prompt for extension-side code symbol enrichment (fallback). */
const CODE_ENRICH_SYSTEM = `You are a code analyst. Given a code symbol's source code, produce a JSON response with:
1. "summary": 1-3 sentence description of what the function/class does
2. "pseudo_code": Structured numbered steps describing the algorithm/logic (use \\n for newlines)
Respond ONLY with valid JSON: {"summary":"...","pseudo_code":"1. Step one\\n2. Step two\\n..."}`;

export class GraphPanel extends BasePanel {
  constructor(mcpManager: IServerManager, extensionUri: vscode.Uri) {
    super("graph", mcpManager, extensionUri);
  }

  getHtml(webview: vscode.Webview): string {
    return this.getIframeHtml();
  }

  async loadData(): Promise<void> {
    // No-op: iframe loads data directly from MCP server API
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    if ((msg as any).type === 'enrich_code_symbol') {
      await this.handleEnrichCodeSymbol(msg as any);
    }
  }

  /** SA4E-106: Extension-side fallback enrichment when backend LLM unavailable. */
  private async handleEnrichCodeSymbol(msg: { symbolId: string; content: string; kind: string }): Promise<void> {
    try {
      // Use extension's LLM (Kiro/Claude) to generate summary + pseudo_code
      const userPrompt = `Analyze this ${msg.kind} and produce summary + pseudo code:\n\n---\n${(msg.content || '').slice(0, 3000)}\n---`;
      const response = await vscode.commands.executeCommand<string>(
        'kiroSdlc.llmChat',
        [{ role: 'system', content: CODE_ENRICH_SYSTEM }, { role: 'user', content: userPrompt }],
        { maxTokens: 800, temperature: 0.3 },
      );

      if (!response) {
        this.sendMessage({ type: 'enrich_code_symbol_result', symbolId: msg.symbolId, status: 'llm_unavailable' } as any);
        return;
      }

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.sendMessage({ type: 'enrich_code_symbol_result', symbolId: msg.symbolId, status: 'parse_error' } as any);
        return;
      }
      const parsed = JSON.parse(jsonMatch[0]);
      const summary = parsed.summary || '';
      const pseudoCode = parsed.pseudo_code || '';

      // Save to backend via MCP
      const backendUrl = getBackendUrl();
      const token = BasePanel.authTokenProvider ? BasePanel.authTokenProvider() : '';
      const numId = msg.symbolId.replace('code:', '').replace('sym-', '');

      await fetch(`${backendUrl}/api/admin/kb/entries/code:${numId}/enrich-save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, pseudoCode }),
      });

      // Send result back to iframe
      this.sendMessage({
        type: 'enrich_code_symbol_result',
        symbolId: msg.symbolId,
        status: 'enriched',
        enrichment: { summary, pseudoCode, status: 'COMPLETED' },
      } as any);
    } catch (err: any) {
      console.debug(`[GraphPanel] Extension enrichment failed: ${err.message}`);
      this.sendMessage({ type: 'enrich_code_symbol_result', symbolId: msg.symbolId, status: 'llm_unavailable' } as any);
    }
  }
}
