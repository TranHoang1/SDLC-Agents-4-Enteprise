/**
 * SteeringCommands --- SA4E-187 Story 1
 * Manual steering rule trigger: QuickPick over inclusion=manual rules,
 * activation applies to the next chat turn via the session store.
 */

import * as vscode from "vscode";
import * as path from "path";
import { loadManualRules } from "../langgraph/steering/steering-loader";
import type { SteeringRule } from "../langgraph/steering/frontmatter";
import { activateManualRules } from "../langgraph/steering/session-store";

export function registerSteeringCommands(context: vscode.ExtensionContext, workspaceRoot?: string): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("kiroSdlc.loadSteeringRule", () => handleLoadSteeringRule(workspaceRoot))
  );
}

async function handleLoadSteeringRule(workspaceRoot?: string): Promise<void> {
  const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) { vscode.window.showErrorMessage("No workspace folder open."); return; }

  let rules: SteeringRule[];
  try {
    rules = await loadManualRules(root);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to load steering rules: ${(err as Error).message}`);
    return;
  }
  if (rules.length === 0) {
    vscode.window.showInformationMessage("No manual steering rules found (.code-intel/steering/*.md with inclusion: manual).");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    rules.map(toQuickPickItem),
    { placeHolder: "Select manual steering rule(s) to inject into the next chat turn", canPickMany: true }
  );
  if (!picked || picked.length === 0) return;

  const activated = activateManualRules(root, picked.map(p => p.rule));
  vscode.window.showInformationMessage(
    `✅ ${activated} steering rule(s) activated — they will be injected into the next chat turn.`
  );
}

interface RuleQuickPickItem extends vscode.QuickPickItem {
  rule: SteeringRule;
}

function toQuickPickItem(rule: SteeringRule): RuleQuickPickItem {
  const name = rule.meta.title || path.basename(rule.filePath, ".md");
  return {
    label: `$(book) ${name}`,
    description: rule.filePath,
    detail: (rule.content || "").slice(0, 100).replace(/\n/g, " "),
    rule,
  };
}
