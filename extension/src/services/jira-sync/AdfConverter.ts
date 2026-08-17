/**
 * SA4E-102 — AdfConverter: Converts Atlassian Document Format (ADF) JSON to Markdown.
 * Handles: headings, paragraphs, lists, code blocks, mentions, links, tables, media.
 * Fallback: if ADF parse fails, strips HTML tags from renderedBody.
 */

/** ADF node type definitions */
interface AdfNode {
    type: string;
    content?: AdfNode[];
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/**
 * Convert ADF JSON to Markdown string.
 * @param adf Raw ADF object (parsed JSON from Jira API)
 * @returns Markdown text
 */
export function adfToMarkdown(adf: unknown): string {
    if (!adf || typeof adf !== "object") { return ""; }
    const doc = adf as AdfNode;
    if (doc.type !== "doc" || !doc.content) { return tryFlattenText(doc); }
    return doc.content.map(node => convertNode(node)).join("\n\n");
}

/**
 * Fallback: strip HTML tags from rendered body.
 * @param html Raw HTML string from Jira renderedBody
 * @returns Plain text with basic formatting preserved
 */
export function htmlToPlaintext(html: string | null | undefined): string {
    if (!html) { return ""; }
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li>/gi, "- ")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<h([1-6])[^>]*>/gi, (_, level) => "#".repeat(parseInt(level)) + " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Convert a single ADF node to markdown. */
function convertNode(node: AdfNode): string {
    switch (node.type) {
        case "paragraph": return convertInlineContent(node.content);
        case "heading": return convertHeading(node);
        case "bulletList": return convertList(node, "bullet");
        case "orderedList": return convertList(node, "ordered");
        case "listItem": return convertListItem(node);
        case "codeBlock": return convertCodeBlock(node);
        case "blockquote": return convertBlockquote(node);
        case "table": return convertTable(node);
        case "mediaSingle": return convertMedia(node);
        case "panel": return convertPanel(node);
        case "rule": return "---";
        default: return convertInlineContent(node.content);
    }
}

/** Convert heading node: # level + content. */
function convertHeading(node: AdfNode): string {
    const level = (node.attrs?.level as number) || 1;
    const prefix = "#".repeat(Math.min(level, 6));
    return `${prefix} ${convertInlineContent(node.content)}`;
}

/** Convert bullet or ordered list. */
function convertList(node: AdfNode, style: "bullet" | "ordered"): string {
    if (!node.content) { return ""; }
    return node.content.map((item, i) => {
        const prefix = style === "bullet" ? "-" : `${i + 1}.`;
        const text = convertListItem(item);
        return `${prefix} ${text}`;
    }).join("\n");
}

/** Convert list item content. */
function convertListItem(node: AdfNode): string {
    if (!node.content) { return ""; }
    return node.content.map(child => {
        if (child.type === "paragraph") { return convertInlineContent(child.content); }
        return convertNode(child);
    }).join("\n  ");
}

/** Convert code block with optional language. */
function convertCodeBlock(node: AdfNode): string {
    const lang = (node.attrs?.language as string) || "";
    const code = node.content?.map(c => c.text || "").join("") || "";
    return "```" + lang + "\n" + code + "\n```";
}

/** Convert blockquote. */
function convertBlockquote(node: AdfNode): string {
    if (!node.content) { return ""; }
    return node.content
        .map(child => `> ${convertNode(child)}`)
        .join("\n");
}

/** Convert ADF table to markdown table. */
function convertTable(node: AdfNode): string {
    if (!node.content) { return ""; }
    const rows = node.content.filter(r => r.type === "tableRow");
    if (rows.length === 0) { return ""; }

    const lines: string[] = [];
    rows.forEach((row, rowIdx) => {
        const cells = (row.content || []).map(cell =>
            convertInlineContent(cell.content?.flatMap(p => p.content || []))
        );
        lines.push(`| ${cells.join(" | ")} |`);
        if (rowIdx === 0) {
            lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
        }
    });
    return lines.join("\n");
}

/** Convert media/attachment reference. */
function convertMedia(node: AdfNode): string {
    const media = node.content?.find(c => c.type === "media");
    if (!media) { return ""; }
    const id = media.attrs?.id || "attachment";
    const alt = (media.attrs?.alt as string) || `attachment-${id}`;
    return `![${alt}](attachment:${id})`;
}

/** Convert panel (info/warning/note). */
function convertPanel(node: AdfNode): string {
    const panelType = (node.attrs?.panelType as string) || "info";
    const icon = panelType === "warning" ? "⚠️" : panelType === "error" ? "❌" : "ℹ️";
    const content = node.content?.map(c => convertNode(c)).join("\n") || "";
    return `> ${icon} **${panelType.toUpperCase()}**\n> ${content.replace(/\n/g, "\n> ")}`;
}

/** Convert inline content array to text with marks. */
function convertInlineContent(nodes: AdfNode[] | undefined): string {
    if (!nodes) { return ""; }
    return nodes.map(node => {
        if (node.type === "text") { return applyMarks(node.text || "", node.marks); }
        if (node.type === "mention") { return `@${node.attrs?.text || node.attrs?.id || "user"}`; }
        if (node.type === "emoji") { return (node.attrs?.shortName as string) || ""; }
        if (node.type === "hardBreak") { return "\n"; }
        if (node.type === "inlineCard") { return (node.attrs?.url as string) || ""; }
        return node.text || "";
    }).join("");
}

/** Apply text marks (bold, italic, code, link, etc). */
function applyMarks(text: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>): string {
    if (!marks || marks.length === 0) { return text; }
    let result = text;
    for (const mark of marks) {
        switch (mark.type) {
            case "strong": result = `**${result}**`; break;
            case "em": result = `*${result}*`; break;
            case "code": result = `\`${result}\``; break;
            case "strike": result = `~~${result}~~`; break;
            case "link": {
                const href = mark.attrs?.href || "";
                result = `[${result}](${href})`;
                break;
            }
        }
    }
    return result;
}

/** Try to extract plain text from an unknown node structure. */
function tryFlattenText(node: unknown): string {
    if (!node || typeof node !== "object") { return ""; }
    const n = node as AdfNode;
    if (n.text) { return n.text; }
    if (n.content) { return n.content.map(c => tryFlattenText(c)).join(" "); }
    return "";
}
