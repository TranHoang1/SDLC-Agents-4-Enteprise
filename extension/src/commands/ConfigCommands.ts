/**
 * SA4E-193 — Config Commands: /create-new-agent, /create-new-hook,
 * /create-new-steering, /create-new-skill.
 *
 * Thin orchestrators (M1): dialogs -> LLM generation (L-Gen) -> ValidationGate
 * (L-Gate) -> collision stub -> file write (L-IO) -> editor/toast (L-Post).
 * Heavy lifting lives in validation-gate/hook-gate/frontmatter-utils,
 * template-provider, name-extractor and file-writer modules.
 * Dialog strings and toast templates are contractual (FSD §3.8) — do NOT edit.
 */

import * as vscode from "vscode";
import * as path from "path";
import { ConfigType, ValidationGate } from "./validation-gate";
import { getLlmPrompt, getFallbackScaffold } from "./template-provider";
import { extractNameFromDescription } from "./name-extractor";
import { writeFileWithMkdir, targetExists } from "./file-writer";
import { KEBAB_CASE_RE } from "./frontmatter-utils";
import {
  AGENT_SPEC,
  HOOK_SPEC,
  SKILL_SPEC,
  STEERING_SPEC,
  ConfigCommandSpec,
} from "./config-command-specs";

/**
 * Register SA4E-193 config commands. Called from CommandRegistrar.
 * Command IDs match the slash menu dispatch format (/create-new-agent etc.);
 * undefined workspace root => skip registration entirely.
 */
export function registerConfigCommands(
  context: vscode.ExtensionContext,
  workspaceRoot?: string
): void {
  const root = workspaceRoot || getWorkspaceRoot();
  if (!root) return;

  context.subscriptions.push(
    vscode.commands.registerCommand("create-new-agent", (args?: { rawArgs?: string }) =>
      runCreateFlow(root, AGENT_SPEC, args?.rawArgs)
    ),
    vscode.commands.registerCommand("create-new-hook", (args?: { rawArgs?: string }) =>
      runCreateFlow(root, HOOK_SPEC, args?.rawArgs)
    ),
    vscode.commands.registerCommand("create-new-steering", (args?: { rawArgs?: string }) =>
      runCreateFlow(root, STEERING_SPEC, args?.rawArgs)
    ),
    vscode.commands.registerCommand("create-new-skill", (args?: { rawArgs?: string }) =>
      runCreateFlow(root, SKILL_SPEC, args?.rawArgs)
    )
  );
}

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

/** PL-1 step 1 (BR-02): inline rawArgs wins; otherwise mandatory InputBox. */
async function resolveDescription(
  spec: ConfigCommandSpec,
  rawArgs?: string
): Promise<string | undefined> {
  if (rawArgs) return rawArgs;
  return vscode.window.showInputBox({
    prompt: spec.descriptionPrompt,
    placeHolder: spec.descriptionPlaceholder,
    validateInput: (value) =>
      !value || value.trim().length === 0 ? "Description is required" : null,
  });
}

/** PL-1 step 2 (BR-03/BR-04): kebab-case name confirmed against suggestion. */
async function confirmName(spec: ConfigCommandSpec, description: string): Promise<string | undefined> {
  const suggestedName = extractNameFromDescription(description, spec.namePrefix);
  return vscode.window.showInputBox({
    prompt: spec.namePrompt,
    value: suggestedName,
    validateInput: (value) =>
      !value || !KEBAB_CASE_RE.test(value)
        ? `Name must be kebab-case (e.g., ${spec.nameExample})`
        : null,
  });
}

/** ERR-CMD-04: gate rejected the content — nothing was written; surface reason verbatim. */
function reportGateFailure(spec: ConfigCommandSpec, reason?: string): void {
  vscode.window.showErrorMessage(`Failed to create ${spec.errorLabel}: ${reason}`);
}

/** ERR-CMD-06 STUB — overwrite policy pending OI-01/GAP-05 decision. */
async function warnOnCollision(filePath: string): Promise<void> {
  if (!(await targetExists(filePath))) return;
  console.debug("[ConfigCommands] target collision:", filePath);
  void vscode.window.showWarningMessage(
    `"${path.basename(filePath)}" already exists and will be overwritten.`
  );
}

/** Post-write editor open (FR-COMMON-03; standard text editor until SA4E-190). */
async function openGeneratedFile(filePath: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(doc);
}

/** Shared pipeline PL-1 orchestrator (thin): input -> generate -> gate -> persist. */
async function runCreateFlow(
  root: string,
  spec: ConfigCommandSpec,
  rawArgs?: string
): Promise<void> {
  const description = await resolveDescription(spec, rawArgs);
  if (!description) return; // ERR-CMD-01: silent abort, no file, no toast

  const name = await confirmName(spec, description);
  if (!name) return;

  const generated = await generateConfig(spec.kind, description, name); // L-Gen: never throws
  const gate = ValidationGate.validate(spec.kind, generated, name, description); // BR-07
  if (!gate.ok) {
    reportGateFailure(spec, gate.reason);
    return;
  }
  await persistGeneratedFile(root, spec, name, gate.normalized);
}

/** Write + post-write actions. Editor-open failure must NOT flip success (D-3). */
async function persistGeneratedFile(
  root: string,
  spec: ConfigCommandSpec,
  name: string,
  content: string
): Promise<void> {
  const filePath = spec.targetPath(root, name);
  await warnOnCollision(filePath);
  try {
    await writeFileWithMkdir(filePath, content); // L-IO (ERR-CMD-05)
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to create ${spec.errorLabel}: ${(err as Error).message}`);
    return;
  }
  try {
    // L-Post (ERR-CMD-08): isolated try — open failure is warn-only.
    await openGeneratedFile(filePath);
  } catch (err) {
    console.debug("[ConfigCommands] failed to open generated file:", filePath, (err as Error).message);
    void vscode.window.showWarningMessage(`Created "${name}", but the editor could not be opened.`);
  }
  vscode.window.showInformationMessage(spec.successMessage(name));
}

/**
 * LLM generation via VS Code language model API; transparently falls back to
 * the deterministic template scaffold. NEVER throws (FR-COMMON-02).
 */
async function generateConfig(
  kind: ConfigType,
  description: string,
  confirmedName: string
): Promise<string> {
  // F1 failure taxonomy: older extension hosts lack vscode.lm despite typings.
  if (typeof vscode.lm?.selectChatModels === "function") {
    try {
      const streamed = await streamFromCopilot(getLlmPrompt(kind), description, kind);
      if (streamed.trim().length > 0) return streamed; // D-4: empty stream => fallback promotion
    } catch (err) {
      console.debug("[ConfigCommands] LLM generation failed, falling back to template:", (err as Error).message);
    }
  }
  return getFallbackScaffold(kind, confirmedName, description); // D-5: confirmedName honored
}

/** Stream one completion from the first copilot chat model; "" when none available. */
async function streamFromCopilot(
  systemPrompt: string,
  description: string,
  fileType: string
): Promise<string> {
  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
  if (!models || models.length === 0) return "";
  const model = models[0];
  const request = [
    vscode.LanguageModelChatMessage.User(systemPrompt),
    vscode.LanguageModelChatMessage.User(
      `Create a ${fileType} configuration based on this description: ${description}`
    ),
  ];
  const response = await model.sendRequest(request, {}, new vscode.CancellationTokenSource().token);
  let result = "";
  for await (const chunk of response.text) {
    result += chunk;
  }
  return result;
}
