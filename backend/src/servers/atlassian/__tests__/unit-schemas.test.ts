/**
 * SA4E-110 — Unit tests for schemas, tool naming, code quality
 * UT-01, UT-02, UT-08, UT-09, UT-19, UT-20
 */
import { describe, it, expect } from 'vitest';
import { IssueKeySchema, JqlSchema, SearchJqlSchema, CreateIssueSchema } from '../models/jira-schemas.js';
import { sanitizeJiraError, mapStatusToErrorCode, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { CredentialResponseSchema } from '../credentials/credential-schemas.js';

describe('UT-01: IssueKeySchema — validates PROJ-123 format', () => {
  it('accepts valid issue keys', () => {
    expect(IssueKeySchema.safeParse('PROJ-123').success).toBe(true);
    expect(IssueKeySchema.safeParse('AB1-1').success).toBe(true);
    expect(IssueKeySchema.safeParse('TEAM-99999').success).toBe(true);
  });

  it('rejects invalid issue keys', () => {
    expect(IssueKeySchema.safeParse('proj-123').success).toBe(false);
    expect(IssueKeySchema.safeParse('PROJ').success).toBe(false);
    expect(IssueKeySchema.safeParse('123-ABC').success).toBe(false);
    expect(IssueKeySchema.safeParse('').success).toBe(false);
    expect(IssueKeySchema.safeParse('-123').success).toBe(false);
  });
});

describe('UT-02: JqlSchema — enforces length constraints', () => {
  it('accepts valid JQL queries', () => {
    expect(JqlSchema.safeParse('project = PROJ').success).toBe(true);
    expect(JqlSchema.safeParse('a').success).toBe(true);
  });

  it('rejects empty JQL', () => {
    expect(JqlSchema.safeParse('').success).toBe(false);
  });

  it('rejects JQL exceeding 2000 chars', () => {
    const longJql = 'x'.repeat(2001);
    expect(JqlSchema.safeParse(longJql).success).toBe(false);
  });

  it('accepts JQL at exactly 2000 chars', () => {
    const maxJql = 'x'.repeat(2000);
    expect(JqlSchema.safeParse(maxJql).success).toBe(true);
  });
});

describe('UT-08: SearchJqlSchema — pagination constraints', () => {
  it('maxResults cannot exceed 100', () => {
    const result = SearchJqlSchema.safeParse({ jql: 'a', maxResults: 101 });
    expect(result.success).toBe(false);
  });

  it('provides defaults for pagination', () => {
    const result = SearchJqlSchema.safeParse({ jql: 'project = X' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startAt).toBe(0);
      expect(result.data.maxResults).toBe(50);
    }
  });
});

describe('UT-09: mapStatusToErrorCode — HTTP status mapping', () => {
  it('maps 401 to AUTH_FAILED', () => {
    expect(mapStatusToErrorCode(401)).toBe(AtlassianErrorCode.AUTH_FAILED);
  });

  it('maps 403 to FORBIDDEN', () => {
    expect(mapStatusToErrorCode(403)).toBe(AtlassianErrorCode.FORBIDDEN);
  });

  it('maps 404 to NOT_FOUND', () => {
    expect(mapStatusToErrorCode(404)).toBe(AtlassianErrorCode.NOT_FOUND);
  });

  it('maps 429 to RATE_LIMITED', () => {
    expect(mapStatusToErrorCode(429)).toBe(AtlassianErrorCode.RATE_LIMITED);
  });

  it('maps 5xx to SERVER_ERROR', () => {
    expect(mapStatusToErrorCode(500)).toBe(AtlassianErrorCode.SERVER_ERROR);
    expect(mapStatusToErrorCode(503)).toBe(AtlassianErrorCode.SERVER_ERROR);
  });

  it('maps unknown status to UNKNOWN', () => {
    expect(mapStatusToErrorCode(418)).toBe(AtlassianErrorCode.UNKNOWN);
  });
});

describe('UT-19: CredentialResponseSchema — validates IPC messages', () => {
  it('accepts valid credential response', () => {
    const valid = {
      type: 'credentials',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: Date.now(),
      credentials: { email: 'test@example.com', apiToken: 'token123', baseUrl: 'https://site.atlassian.net' },
    };
    expect(CredentialResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid email in credentials', () => {
    const invalid = {
      type: 'credentials',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: Date.now(),
      credentials: { email: 'not-email', apiToken: 'token', baseUrl: 'https://x.net' },
    };
    expect(CredentialResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('UT-20: createErrorResult — error response structure', () => {
  it('returns isError true with sanitized message', () => {
    const result = createErrorResult(AtlassianErrorCode.NOT_FOUND, 'Issue not found');
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('NOT_FOUND');
    expect(parsed.message).toBe('Issue not found');
  });
});
