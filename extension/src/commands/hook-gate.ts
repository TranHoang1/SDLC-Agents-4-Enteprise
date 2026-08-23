/**
 * SA4E-193 — Hook branch of the ValidationGate (C1 helper, FSD §6.6.2 CMD2).
 *
 * PURE functions — NO vscode imports.
 * Responsibilities:
 *   - strict JSON parse with fence-stripped input (D-2 / AF-13)
 *   - top-level keys subset check (BR-09)
 *   - conditional consistency: patterns only for file* events; prompt iff
 *     askAgent XOR command iff runCommand (BR-08)
 *   - defaults enabled=true, version="1" (BR-20)
 *   - canonical serialization omitting empty action fields (D-7)
 */

const HOOK_TOP_LEVEL_KEYS = ["enabled", "name", "description", "version", "when", "then"];
const HOOK_TRIGGER_TYPES = ["promptSubmit", "agentStop", "fileEdited", "fileCreated", "fileDeleted"];
const HOOK_FILE_EVENT_TYPES = ["fileEdited", "fileCreated", "fileDeleted"];
const HOOK_ACTION_TYPES = ["askAgent", "runCommand"];

/** Canonical hook form: 2-space indent JSON; empty-string action fields OMITTED (D-7). */
export function serializeHookCanonical(hook: Record<string, unknown>): string {
  const clone: Record<string, unknown> = { ...hook };
  if (clone.then && typeof clone.then === "object" && !Array.isArray(clone.then)) {
    const action = { ...(clone.then as Record<string, unknown>) };
    for (const key of Object.keys(action)) {
      if (typeof action[key] === "string" && (action[key] as string).trim().length === 0) {
        delete action[key];
      }
    }
    clone.then = action;
  }
  return JSON.stringify(clone, null, 2);
}

/** Apply BR-20 defaults: enabled=true, version="1". */
function applyHookDefaults(hook: Record<string, unknown>): void {
  if (hook.enabled === undefined) hook.enabled = true;
  if (hook.version === undefined) hook.version = "1";
}

/** BR-08 trigger rules: when.type enum; patterns only for file* events. */
function validateHookWhen(hook: Record<string, unknown>): string | undefined {
  const when = hook.when;
  if (when === null || typeof when !== "object" || Array.isArray(when)) {
    return 'hook "when" must be an object';
  }
  const w = when as Record<string, unknown>;
  if (!HOOK_TRIGGER_TYPES.includes(w.type as string)) {
    return `hook when.type "${String(w.type)}" must be one of: ${HOOK_TRIGGER_TYPES.join(", ")} (BR-08)`;
  }
  if (w.patterns !== undefined) {
    if (!HOOK_FILE_EVENT_TYPES.includes(w.type as string)) {
      return "hook when.patterns is allowed only for fileEdited/fileCreated/fileDeleted events (BR-08)";
    }
    if (!Array.isArray(w.patterns) || w.patterns.some((p) => typeof p !== "string")) {
      return "hook when.patterns must be an array of strings (BR-08)";
    }
  }
  return undefined;
}

/**
 * Empty/whitespace-only action fields count as ABSENT (D-7): the canonical
 * serializer omits them, so accepting them here would emit an artifact whose
 * action cannot execute (e.g. runCommand with no command on disk).
 */
function isAbsentActionField(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

/** BR-08 action XOR: non-empty prompt iff askAgent, non-empty command iff runCommand. */
function validateHookThen(hook: Record<string, unknown>): string | undefined {
  const thenAction = hook.then;
  if (thenAction === null || typeof thenAction !== "object" || Array.isArray(thenAction)) {
    return 'hook "then" must be an object';
  }
  const t = thenAction as Record<string, unknown>;
  if (!HOOK_ACTION_TYPES.includes(t.type as string)) {
    return `hook then.type "${String(t.type)}" must be one of: askAgent, runCommand`;
  }
  if (t.type === "askAgent" && isAbsentActionField(t.prompt)) {
    return 'hook then.prompt is required when then.type is "askAgent" (BR-08)';
  }
  if (t.type === "runCommand" && isAbsentActionField(t.command)) {
    return 'hook then.command is required when then.type is "runCommand" (BR-08)';
  }
  return undefined;
}

/** Field constraints per FSD §3.7.2. Returns the violation reason or undefined. */
function hookSchemaError(hook: Record<string, unknown>): string | undefined {
  if (!hook.name || typeof hook.name !== "string") {
    return 'hook "name" is required and must be a non-empty string';
  }
  if (!hook.description || typeof hook.description !== "string") {
    return 'hook "description" is required and must be a non-empty string';
  }
  if (hook.enabled !== undefined && typeof hook.enabled !== "boolean") {
    return 'hook "enabled" must be a boolean';
  }
  if (hook.version !== undefined && typeof hook.version !== "string") {
    return 'hook "version" must be a string';
  }
  return validateHookWhen(hook) ?? validateHookThen(hook);
}

/**
 * CMD2 gate entry: normalized text -> canonical JSON bytes or failure reason
 * (ERR-CMD-04). Caller guarantees fences were already stripped by NORMALIZE.
 */
export function validateHookContent(normalized: string): { ok: boolean; reason?: string; normalized: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(normalized);
  } catch (err) {
    return { ok: false, reason: `invalid hook JSON: ${(err as Error).message}`, normalized: "" };
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, reason: "hook must be a JSON object", normalized: "" };
  }
  const hook = obj as Record<string, unknown>;
  for (const key of Object.keys(hook)) {
    if (!HOOK_TOP_LEVEL_KEYS.includes(key)) {
      const allowed = HOOK_TOP_LEVEL_KEYS.map((k) => `"${k}"`).join(", ");
      return { ok: false, reason: `unknown hook top-level key "${key}" (allowed: ${allowed})`, normalized: "" };
    }
  }
  applyHookDefaults(hook);
  const schemaError = hookSchemaError(hook);
  if (schemaError) return { ok: false, reason: schemaError, normalized: "" };
  return { ok: true, normalized: serializeHookCanonical(hook) };
}
