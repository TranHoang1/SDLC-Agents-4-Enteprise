/**
 * SA4E-102 — Jira Sync module barrel export.
 */
export { adfToMarkdown, htmlToPlaintext } from "./AdfConverter";
export { summarizeComments, extractAllTicketRefs, formatCommentSummaries } from "./CommentSummarizer";
export type { JiraComment, CommentSummary } from "./CommentSummarizer";
export { LinkCrawler } from "./LinkCrawler";
export type { CrawledIssue, IssueLink, SubTask, AttachmentMeta } from "./LinkCrawler";
export { buildKbEntries } from "./KbEntryBuilder";
export type { KbEntry } from "./KbEntryBuilder";
export { getSyncState, saveSyncState, buildIncrementalJql, isFullSync, nowIso } from "./SyncState";
export type { ProjectSyncState } from "./SyncState";
export { AttachmentFetcher } from "./AttachmentFetcher";
export type { FetchedAttachment } from "./AttachmentFetcher";
