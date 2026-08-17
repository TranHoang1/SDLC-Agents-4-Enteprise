/**
 * SA4E-102 — CommentSummarizer: Summarizes Jira comments into 1-line per comment.
 * Extracts ticket references from comment bodies for link graph enrichment.
 */
import { adfToMarkdown, htmlToPlaintext } from "./AdfConverter";

/** Raw Jira comment from API response */
export interface JiraComment {
    id: string;
    author: { displayName?: string; name?: string };
    body?: unknown;
    renderedBody?: string;
    created: string;
    updated?: string;
}

/** Summarized comment output */
export interface CommentSummary {
    date: string;
    author: string;
    summary: string;
    ticketRefs: string[];
}

/** Ticket key regex pattern */
const TICKET_PATTERN = /\b[A-Z][A-Z0-9_]+-\d+\b/g;

/**
 * Summarize a list of Jira comments.
 * @param comments Raw comments from Jira API
 * @returns Array of summarized comments with extracted ticket refs
 */
export function summarizeComments(comments: JiraComment[]): CommentSummary[] {
    return comments.map(comment => summarizeOne(comment));
}

/**
 * Get all unique ticket references found across all comments.
 * @param summaries Summarized comments
 * @returns Deduplicated set of ticket keys
 */
export function extractAllTicketRefs(summaries: CommentSummary[]): string[] {
    const refs = new Set<string>();
    for (const s of summaries) {
        for (const ref of s.ticketRefs) { refs.add(ref); }
    }
    return [...refs];
}

/**
 * Format comment summaries as markdown text for KB entry.
 * @param summaries Summarized comments
 * @returns Formatted markdown string
 */
export function formatCommentSummaries(summaries: CommentSummary[]): string {
    if (summaries.length === 0) { return "No comments."; }
    return summaries
        .map(s => `- [${s.date}] @${s.author}: ${s.summary}`)
        .join("\n");
}

/** Summarize a single comment. */
function summarizeOne(comment: JiraComment): CommentSummary {
    const date = formatDate(comment.created);
    const author = comment.author?.displayName || comment.author?.name || "unknown";
    const fullText = extractText(comment);
    const summary = truncateSummary(fullText, 120);
    const ticketRefs = extractTicketRefs(fullText);

    return { date, author, summary, ticketRefs };
}

/** Extract plain text from comment body (ADF or rendered HTML). */
function extractText(comment: JiraComment): string {
    if (comment.body && typeof comment.body === "object") {
        const md = adfToMarkdown(comment.body);
        if (md.trim()) { return md; }
    }
    if (comment.renderedBody) {
        return htmlToPlaintext(comment.renderedBody);
    }
    if (typeof comment.body === "string") { return comment.body; }
    return "";
}

/** Truncate text to maxLen chars, ending at word boundary. */
function truncateSummary(text: string, maxLen: number): string {
    const oneLine = text.replace(/\n+/g, " ").trim();
    if (oneLine.length <= maxLen) { return oneLine; }
    const cut = oneLine.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > maxLen * 0.5 ? cut.slice(0, lastSpace) : cut) + "...";
}

/** Extract all ticket key references from text. */
function extractTicketRefs(text: string): string[] {
    const matches = text.match(TICKET_PATTERN);
    return matches ? [...new Set(matches)] : [];
}

/** Format ISO date to YYYY-MM-DD. */
function formatDate(isoDate: string): string {
    try { return new Date(isoDate).toISOString().slice(0, 10); }
    catch { return isoDate.slice(0, 10); }
}
