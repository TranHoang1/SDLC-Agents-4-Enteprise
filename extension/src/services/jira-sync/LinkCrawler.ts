/**
 * SA4E-102 — LinkCrawler: BFS crawl of Jira issue links with anti-loop protection.
 * Max depth = 2. Collects linked issues for full-deep indexing (no attachment download).
 */
import { AtlassianHttpClient } from "../../mcp/atlassian/atlassian-http-client";

/** Crawled issue data */
export interface CrawledIssue {
    key: string;
    summary: string;
    description: unknown;
    renderedDescription?: string;
    status: string;
    issuetype: string;
    priority: string;
    labels: string[];
    assignee: string | null;
    issuelinks: IssueLink[];
    subtasks: SubTask[];
    attachments: AttachmentMeta[];
    comments: unknown[];
    depth: number;
}

/** Issue link from Jira API */
export interface IssueLink {
    type: string;
    direction: "inward" | "outward";
    linkedKey: string;
    linkedSummary: string;
    linkedStatus: string;
}

/** Sub-task reference */
export interface SubTask {
    key: string;
    summary: string;
    status: string;
}

/** Attachment metadata (no binary content) */
export interface AttachmentMeta {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    contentUrl: string;
}

const MAX_DEPTH = 2;

export class LinkCrawler {
    private visited = new Set<string>();
    private results: CrawledIssue[] = [];

    constructor(
        private readonly client: AtlassianHttpClient,
        private readonly log: (msg: string) => void,
    ) {}

    /** Get the set of visited keys (useful for dedup). */
    getVisitedKeys(): Set<string> { return this.visited; }

    /** Get all crawled issues. */
    getResults(): CrawledIssue[] { return this.results; }

    /**
     * Crawl a single issue and its linked issues recursively.
     * @param key Issue key to start from
     * @param depth Current depth (0 = primary ticket)
     */
    async crawl(key: string, depth: number = 0): Promise<void> {
        if (this.visited.has(key)) { return; }
        if (depth > MAX_DEPTH) { return; }
        this.visited.add(key);

        try {
            const issue = await this.fetchIssue(key);
            if (!issue) { return; }

            const crawled = this.mapToCrawledIssue(issue, depth);
            this.results.push(crawled);

            // Recursively crawl linked issues
            const linkedKeys = this.extractLinkedKeys(crawled);
            for (const linkedKey of linkedKeys) {
                await this.crawl(linkedKey, depth + 1);
            }
        } catch (err: any) {
            this.log(`[LinkCrawler] ⚠️ Failed to crawl ${key}: ${err.message}`);
        }
    }

    /**
     * Crawl multiple primary keys (batch for project-level indexing).
     * @param keys Array of primary issue keys
     * @param onProgress Progress callback
     */
    async crawlBatch(
        keys: string[],
        onProgress?: (crawled: number, total: number) => void,
    ): Promise<CrawledIssue[]> {
        for (let i = 0; i < keys.length; i++) {
            await this.crawl(keys[i], 0);
            if (onProgress) { onProgress(i + 1, keys.length); }
        }
        return this.results;
    }

    /** Fetch full issue data from Jira API. */
    private async fetchIssue(key: string): Promise<any | null> {
        try {
            const res = await this.client.request(
                "GET",
                `/rest/api/2/issue/${key}?expand=renderedFields&fields=summary,description,status,issuetype,priority,labels,assignee,issuelinks,subtasks,attachment,comment`,
            );
            return res.data;
        } catch (err: any) {
            this.log(`[LinkCrawler] ❌ Fetch ${key} failed: ${err.message}`);
            return null;
        }
    }

    /** Map raw Jira API response to CrawledIssue. */
    private mapToCrawledIssue(raw: any, depth: number): CrawledIssue {
        const f = raw.fields || {};
        return {
            key: raw.key,
            summary: f.summary || "",
            description: f.description,
            renderedDescription: raw.renderedFields?.description,
            status: f.status?.name || "Unknown",
            issuetype: f.issuetype?.name || "Unknown",
            priority: f.priority?.name || "Medium",
            labels: f.labels || [],
            assignee: f.assignee?.displayName || null,
            issuelinks: this.mapLinks(f.issuelinks || []),
            subtasks: this.mapSubtasks(f.subtasks || []),
            attachments: this.mapAttachments(f.attachment || []),
            comments: f.comment?.comments || [],
            depth,
        };
    }

    /** Extract issue links from Jira response. */
    private mapLinks(links: any[]): IssueLink[] {
        return links.map(link => {
            const isInward = !!link.inwardIssue;
            const linked = isInward ? link.inwardIssue : link.outwardIssue;
            if (!linked) { return null; }
            return {
                type: isInward
                    ? (link.type?.inward || "relates to")
                    : (link.type?.outward || "relates to"),
                direction: isInward ? "inward" as const : "outward" as const,
                linkedKey: linked.key,
                linkedSummary: linked.fields?.summary || "",
                linkedStatus: linked.fields?.status?.name || "Unknown",
            };
        }).filter(Boolean) as IssueLink[];
    }

    /** Extract subtask references. */
    private mapSubtasks(subtasks: any[]): SubTask[] {
        return subtasks.map(st => ({
            key: st.key,
            summary: st.fields?.summary || "",
            status: st.fields?.status?.name || "Unknown",
        }));
    }

    /** Extract attachment metadata. */
    private mapAttachments(attachments: any[]): AttachmentMeta[] {
        return attachments.map(att => ({
            id: att.id,
            filename: att.filename || "unknown",
            size: att.size || 0,
            mimeType: att.mimeType || "application/octet-stream",
            contentUrl: att.content || "",
        }));
    }

    /** Extract all linked issue keys from a crawled issue. */
    private extractLinkedKeys(issue: CrawledIssue): string[] {
        const keys: string[] = [];
        for (const link of issue.issuelinks) { keys.push(link.linkedKey); }
        for (const sub of issue.subtasks) { keys.push(sub.key); }
        return keys;
    }
}
