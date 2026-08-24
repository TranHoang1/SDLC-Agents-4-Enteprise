/**
 * Steering front-matter model + parser --- SA4E-187
 * Extracted from steering-loader.ts (SRP). Parsing semantics preserved:
 * unknown inclusion fails CLOSED to "manual" (F-03 remediation).
 */

export interface SteeringMeta {
  targets: "kiro" | "langgraph" | "all";
  inclusion: "always" | "auto" | "fileMatch" | "manual";
  fileMatchPattern?: string;
  title?: string;
  priority?: number;
}

export interface SteeringRule {
  /** File path relative to workspace */
  filePath: string;
  meta: SteeringMeta;
  /** Markdown content (body without front-matter) */
  content: string;
}

/** Conditional rule carried through LangGraph state between nodes/turns */
export interface ActiveSteeringRule {
  id: string;
  title: string;
  content: string;
}

const FRONT_MATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseSteeringFile(raw: string, filePath: string): SteeringRule | null {
  const match = raw.match(FRONT_MATTER_REGEX);

  if (match) {
    const frontMatter = match[1];
    const body = match[2].trim();
    const meta = parseFrontMatter(frontMatter);
    return { filePath, meta, content: body };
  }

  return {
    filePath,
    meta: {
      targets: "all",
      inclusion: "manual",
    },
    content: raw.trim(),
  };
}

function parseFrontMatter(raw: string): SteeringMeta {
  const meta: SteeringMeta = {
    targets: "all",
    inclusion: "always",
  };

  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");

    switch (key) {
      case "targets":
        if (value === "kiro" || value === "langgraph" || value === "all") {
          meta.targets = value;
        }
        break;
      case "inclusion": {
        const normalized = value.trim().toLowerCase();
        if (normalized === "always" || normalized === "auto" || normalized === "manual") {
          meta.inclusion = normalized;
        } else if (normalized === "filematch") {
          meta.inclusion = "fileMatch";
        } else if (value !== "") {
          console.debug(`[SteeringLoader] unknown inclusion "${value}"; treating as manual`);
          meta.inclusion = "manual";
        }
        break;
      }
      case "filematchpattern":
        meta.fileMatchPattern = value;
        break;
      case "title":
        meta.title = value;
        break;
      case "priority":
        meta.priority = parseInt(value, 10) || 0;
        break;
    }
  }

  return meta;
}
