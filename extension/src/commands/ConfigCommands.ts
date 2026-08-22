/**
 * SA4E-193 — Config Commands: /create-new-agent, /create-new-hook,
 * /create-new-steering, /create-new-skill
 *
 * Uses LLM to generate configuration files from natural language descriptions.
 * Writes files to .code-intel/ directory structure.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/** Template for agent .md files with YAML frontmatter */
const AGENT_TEMPLATE = `---
name: {{NAME}}
label: {{LABEL}}
description: >
  {{DESCRIPTION}}
phase: {{PHASE}}
tools: ["read", "write", "shell", "@mcp"]
---

{{SYSTEM_PROMPT}}
`;

/** Template for hook .json files */
const HOOK_TEMPLATE = `{
  "enabled": true,
  "name": "{{NAME}}",
  "description": "{{DESCRIPTION}}",
  "version": "1",
  "when": {
    "type": "{{TRIGGER_TYPE}}"
  },
  "then": {
    "type": "{{ACTION_TYPE}}",
    "prompt": "{{ACTION_PROMPT}}"
  }
}`;

/** Template for steering .md files with optional frontmatter */
const STEERING_TEMPLATE = `---
inclusion: {{INCLUSION}}
description: {{DESCRIPTION}}
---

# {{TITLE}}

{{BODY}}
`;

/** Template for skill SKILL.md files */
const SKILL_TEMPLATE = `---
name: {{NAME}}
description: {{DESCRIPTION}}
---

{{BODY}}
`;

/** LLM system prompt for generating agent definitions */
const AGENT_LLM_PROMPT = `You are an expert at creating AI agent definitions for an SDLC pipeline system.

Given a user's description of an agent they want to create, generate a complete agent definition file.

## Required Format

The output MUST be a valid Markdown file with YAML frontmatter containing these fields:
- name: kebab-case identifier (e.g., "test-agent")
- label: Human-readable name (e.g., "Test Agent")
- description: Brief description of the agent's role
- phase: SDLC phase (requirements, specification, design, test_planning, implementation, testing, deployment)
- tools: Array of tools the agent can use (default: ["read", "write", "shell", "@mcp"])

After the frontmatter, include a comprehensive system prompt that:
1. Defines the agent's role and responsibilities
2. Specifies what it can and cannot do
3. Includes relevant quality rules and constraints
4. Uses clear, actionable language

## Example Output

---
name: my-agent
label: My Agent
description: >
  A specialized agent for handling specific tasks
phase: implementation
tools: ["read", "write", "shell"]
---

You are a specialized agent for handling specific tasks.

**Your Role:**
- Primary responsibility: [description]
- Key outputs: [list outputs]

**Constraints:**
- [rule 1]
- [rule 2]
`;

/** LLM system prompt for generating hook configurations */
const HOOK_LLM_PROMPT = `You are an expert at creating hook configurations for an SDLC pipeline system.

Given a user's description of a hook they want to create, generate a complete hook configuration file.

## Hook Schema

A hook is a JSON file with these fields:
- enabled: boolean (default: true)
- name: Human-readable name
- description: What the hook does
- version: Version string (default: "1")
- when: Trigger configuration
  - type: "promptSubmit" | "agentStop" | "fileEdited" | "fileCreated" | "fileDeleted"
  - patterns: string[] (optional, for file events - glob patterns)
- then: Action configuration
  - type: "askAgent" | "runCommand"
  - prompt: string (for askAgent type)
  - command: string (for runCommand type)

## Example Output

{
  "enabled": true,
  "name": "My Hook",
  "description": "Description of what the hook does",
  "version": "1",
  "when": {
    "type": "promptSubmit"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Instructions for the agent"
  }
}
`;

/** LLM system prompt for generating steering rule files */
const STEERING_LLM_PROMPT = `You are an expert at creating steering rules for an AI agent system.

Given a user's description of a rule they want to create, generate a complete steering rule file.

## Format

The output MUST be a valid Markdown file with optional YAML frontmatter:

Frontmatter fields:
- inclusion: How the rule is included (auto, manual, always)
- description: Brief description of the rule

After frontmatter, include the rule content with:
- Clear, actionable instructions
- Examples where helpful
- Do's and Don'ts

## Example Output

---
inclusion: auto
description: Code quality standards for TypeScript
---

# TypeScript Code Standards

## Rules

1. Always use TypeScript strict mode
2. Prefer interfaces over type aliases for object shapes
3. Use readonly for immutable properties

## Examples

### ✅ Good
\`\`\`typescript
interface User {
  readonly id: string;
  name: string;
}
\`\`\`

### ❌ Bad
\`\`\`typescript
type User = {
  id: string;
  name: string;
}
\`\`\`
`;

/** LLM system prompt for generating skill definitions */
const SKILL_LLM_PROMPT = `You are an expert at creating skill definitions for an AI agent system.

Given a user's description of a skill they want to create, generate a complete SKILL.md file.

## Format

The output MUST be a valid Markdown file with YAML frontmatter containing:
- name: kebab-case identifier (e.g., "code-review")
- description: Brief description of what the skill does

After frontmatter, include:
- When to use this skill
- Step-by-step workflow
- Tools and resources needed
- Examples

## Example Output

---
name: code-review
description: Automated code review checklist and workflow
---

## When to Use

Use this skill when reviewing pull requests or performing code quality checks.

## Workflow

1. Read the changed files
2. Check for common issues:
   - Security vulnerabilities
   - Performance problems
   - Code style violations
3. Generate review report

## Checklist

- [ ] No hardcoded secrets
- [ ] Error handling is proper
- [ ] Tests are included
- [ ] Documentation is updated
`;

/**
 * Register SA4E-193 config commands.
 * Called from CommandRegistrar.
 *
 * Command IDs match the slash menu dispatch format:
 * - /create-new-agent → 'create-new-agent'
 * - /create-new-hook → 'create-new-hook'
 * - /create-new-steering → 'create-new-steering'
 * - /create-new-skill → 'create-new-skill'
 */
export function registerConfigCommands(
  context: vscode.ExtensionContext,
  workspaceRoot?: string
): void {
  const root = workspaceRoot || getWorkspaceRoot();
  if (!root) return;

  context.subscriptions.push(
    vscode.commands.registerCommand("create-new-agent", (args?: { rawArgs?: string }) =>
      handleCreateNewAgent(root, args?.rawArgs)
    ),
    vscode.commands.registerCommand("create-new-hook", (args?: { rawArgs?: string }) =>
      handleCreateNewHook(root, args?.rawArgs)
    ),
    vscode.commands.registerCommand("create-new-steering", (args?: { rawArgs?: string }) =>
      handleCreateNewSteering(root, args?.rawArgs)
    ),
    vscode.commands.registerCommand("create-new-skill", (args?: { rawArgs?: string }) =>
      handleCreateNewSkill(root, args?.rawArgs)
    )
  );
}

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

/**
 * SA4E-193 CMD1: /create-new-agent
 * Generates a valid agent .md file with YAML frontmatter.
 */
async function handleCreateNewAgent(
  root: string,
  rawArgs?: string
): Promise<void> {
  const description = rawArgs || await vscode.window.showInputBox({
    prompt: "Describe the agent you want to create",
    placeHolder: "e.g., A documentation agent that generates API docs from code comments",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Description is required";
      }
      return null;
    },
  });

  if (!description) return;

  // Extract a name from the description
  const suggestedName = extractNameFromDescription(description, "agent");

  const name = await vscode.window.showInputBox({
    prompt: "Agent name (kebab-case)",
    value: suggestedName,
    validateInput: (value) => {
      if (!value || !/^[a-z][a-z0-9-]*$/.test(value)) {
        return "Name must be kebab-case (e.g., my-agent)";
      }
      return null;
    },
  });

  if (!name) return;

  try {
    const content = await generateWithLLM(AGENT_LLM_PROMPT, description, "agent");
    const frontmatter = buildAgentFrontmatter(name, description);
    const fullContent = frontmatter + "\n\n" + content;

    const filePath = path.join(root, ".code-intel", "agents", `${name}.md`);
    await writeFileWithMkdir(filePath, fullContent);

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`✅ Agent "${name}" created at .code-intel/agents/${name}.md`);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to create agent: ${(err as Error).message}`);
  }
}

/**
 * SA4E-193 CMD2: /create-new-hook
 * Generates a valid hook .json file.
 */
async function handleCreateNewHook(
  root: string,
  rawArgs?: string
): Promise<void> {
  const description = rawArgs || await vscode.window.showInputBox({
    prompt: "Describe the hook you want to create",
    placeHolder: "e.g., Auto-validate XML when draw.io files are edited",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Description is required";
      }
      return null;
    },
  });

  if (!description) return;

  const suggestedName = extractNameFromDescription(description, "hook");

  const name = await vscode.window.showInputBox({
    prompt: "Hook name (kebab-case)",
    value: suggestedName,
    validateInput: (value) => {
      if (!value || !/^[a-z][a-z0-9-]*$/.test(value)) {
        return "Name must be kebab-case (e.g., my-hook)";
      }
      return null;
    },
  });

  if (!name) return;

  try {
    const content = await generateWithLLM(HOOK_LLM_PROMPT, description, "hook");
    const filePath = path.join(root, ".code-intel", "hooks", `${name}.json`);
    await writeFileWithMkdir(filePath, content);

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`✅ Hook "${name}" created at .code-intel/hooks/${name}.json`);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to create hook: ${(err as Error).message}`);
  }
}

/**
 * SA4E-193 CMD3: /create-new-steering
 * Generates a valid steering .md file.
 */
async function handleCreateNewSteering(
  root: string,
  rawArgs?: string
): Promise<void> {
  const description = rawArgs || await vscode.window.showInputBox({
    prompt: "Describe the steering rule you want to create",
    placeHolder: "e.g., Always use semantic versioning for git tags",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Description is required";
      }
      return null;
    },
  });

  if (!description) return;

  const suggestedName = extractNameFromDescription(description, "rule");

  const name = await vscode.window.showInputBox({
    prompt: "Rule name (kebab-case)",
    value: suggestedName,
    validateInput: (value) => {
      if (!value || !/^[a-z][a-z0-9-]*$/.test(value)) {
        return "Name must be kebab-case (e.g., my-rule)";
      }
      return null;
    },
  });

  if (!name) return;

  try {
    const content = await generateWithLLM(STEERING_LLM_PROMPT, description, "steering");
    const filePath = path.join(root, ".code-intel", "steering", `${name}.md`);
    await writeFileWithMkdir(filePath, content);

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`✅ Steering rule "${name}" created at .code-intel/steering/${name}.md`);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to create steering rule: ${(err as Error).message}`);
  }
}

/**
 * SA4E-193 CMD4: /create-new-skill
 * Creates a skill folder with SKILL.md file.
 */
async function handleCreateNewSkill(
  root: string,
  rawArgs?: string
): Promise<void> {
  const description = rawArgs || await vscode.window.showInputBox({
    prompt: "Describe the skill you want to create",
    placeHolder: "e.g., A skill for reviewing code security vulnerabilities",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Description is required";
      }
      return null;
    },
  });

  if (!description) return;

  const suggestedName = extractNameFromDescription(description, "skill");

  const name = await vscode.window.showInputBox({
    prompt: "Skill name (kebab-case)",
    value: suggestedName,
    validateInput: (value) => {
      if (!value || !/^[a-z][a-z0-9-]*$/.test(value)) {
        return "Name must be kebab-case (e.g., my-skill)";
      }
      return null;
    },
  });

  if (!name) return;

  try {
    const content = await generateWithLLM(SKILL_LLM_PROMPT, description, "skill");
    const dirPath = path.join(root, ".code-intel", "skills", name);
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, "SKILL.md");
    await fs.promises.writeFile(filePath, content, "utf-8");

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`✅ Skill "${name}" created at .code-intel/skills/${name}/SKILL.md`);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to create skill: ${(err as Error).message}`);
  }
}

/**
 * Generate content using the VS Code language model (Copilot LLM).
 * Falls back to template-based generation if LLM is unavailable.
 */
async function generateWithLLM(
  systemPrompt: string,
  userDescription: string,
  fileType: string
): Promise<string> {
  // Try to use VS Code language model API (Copilot)
  if (vscode.lm && vscode.lm.selectChatModels) {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      if (models && models.length > 0) {
        const model = models[0];
        const request = [
          vscode.LanguageModelChatMessage.User(systemPrompt),
          vscode.LanguageModelChatMessage.User(`Create a ${fileType} configuration based on this description: ${userDescription}`),
        ];
        const response = await model.sendRequest(request, {}, new vscode.CancellationTokenSource().token);
        let result = "";
        for await (const chunk of response.text) {
          result += chunk;
        }
        return result;
      }
    } catch (err) {
      console.debug("[ConfigCommands] LLM generation failed, falling back to template:", (err as Error).message);
    }
  }

  // Fallback: generate from template
  return generateFromTemplate(fileType, userDescription);
}

/**
 * Fallback template-based generation when LLM is unavailable.
 */
function generateFromTemplate(fileType: string, description: string): string {
  const name = extractNameFromDescription(description, fileType);

  switch (fileType) {
    case "agent":
      return buildAgentFrontmatter(name, description) + "\n\n" +
        `You are the ${name} agent.\n\n**Description:** ${description}\n\n**Role:**\n- [Define the agent's primary role]\n- [Define key responsibilities]\n\n**Constraints:**\n- [List constraints]\n`;

    case "hook": {
      const hook = {
        enabled: true,
        name: name,
        description: description,
        version: "1",
        when: { type: "promptSubmit" },
        then: { type: "askAgent", prompt: `[Instructions for ${name} based on: ${description}]` },
      };
      return JSON.stringify(hook, null, 2);
    }

    case "steering":
      return `---\ninclusion: auto\ndescription: ${description}\n---\n\n# ${name}\n\n${description}\n\n## Rules\n\n1. [Define rule 1]\n2. [Define rule 2]\n`;

    case "skill":
      return `---\nname: ${name}\ndescription: ${description}\n---\n\n## When to Use\n\n${description}\n\n## Workflow\n\n1. [Step 1]\n2. [Step 2]\n`;

    default:
      return description;
  }
}

/**
 * Extract a kebab-case name from a natural language description.
 */
function extractNameFromDescription(description: string, prefix: string): string {
  // Take first few meaningful words, convert to kebab-case
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);

  return words.join("-") || `${prefix}-new`;
}

/**
 * Build agent frontmatter from name and description.
 */
function buildAgentFrontmatter(name: string, description: string): string {
  const label = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return [
    "---",
    `name: ${name}`,
    `label: ${label}`,
    `description: >`,
    `  ${description}`,
    "phase: implementation",
    'tools: ["read", "write", "shell", "@mcp"]',
    "---",
  ].join("\n");
}

/**
 * Write file with automatic parent directory creation.
 */
async function writeFileWithMkdir(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, content, "utf-8");
}
