/**
 * SA4E-110 — Entry point for Atlassian in-process tool registration.
 * Replaces the stdio child process with direct tool handlers in LOCAL_TOOL_REGISTRY.
 * All 65 tools (42 Jira + 23 Confluence) registered with hidden:true.
 */
import { AtlassianCredentialService } from "../../services/AtlassianCredentialService";
import { AtlassianHttpClient } from "./atlassian-http-client";
import { registerJiraIssueTools } from "./jira-issue-tools";
import { registerJiraSearchTools } from "./jira-search-tools";
import { registerJiraTransitionTools } from "./jira-transition-tools";
import { registerJiraCommentTools } from "./jira-comment-tools";
import { registerJiraProjectTools } from "./jira-project-tools";
import { registerJiraAgileTools } from "./jira-agile-tools";
import { registerJiraUserTools } from "./jira-user-tools";
import { registerJiraWorklogTools } from "./jira-worklog-tools";
import { registerJiraAttachmentTools } from "./jira-attachment-tools";
import { registerJiraFieldTools } from "./jira-field-tools";
import { registerConfluenceTools } from "./confluence-tools";

/**
 * Register all 65 Atlassian tools into the extension's local tool registry.
 * Tools execute in-process using native fetch — no child process needed.
 * @param credService Credential service for reading auth from SecretStorage
 */
export function registerAtlassianLocalTools(credService: AtlassianCredentialService): void {
  const client = new AtlassianHttpClient(credService);

  // Jira tools (42 total)
  registerJiraIssueTools(client);       // 8 tools
  registerJiraSearchTools(client);      // 4 tools
  registerJiraTransitionTools(client);  // 3 tools
  registerJiraCommentTools(client);     // 5 tools
  registerJiraProjectTools(client);     // 6 tools
  registerJiraAgileTools(client);       // 5 tools
  registerJiraUserTools(client);        // 4 tools
  registerJiraWorklogTools(client);     // 3 tools
  registerJiraAttachmentTools(client);  // 4 tools (incl. SA4E-229 jira_download_attachment)
  registerJiraFieldTools(client);       // 5 tools (includes jira_get_custom_field)

  // Confluence tools (23 total)
  registerConfluenceTools(client);      // 23 tools
}
