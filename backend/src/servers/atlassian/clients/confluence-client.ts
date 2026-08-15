/**
 * SA4E-110 - Confluence REST API client.
 * Provides typed methods for pages, spaces, search, and content operations.
 */
import { BaseAtlassianClient } from './base-client.js';
import type { HttpResponse } from '../models/types.js';

/**
 * Confluence API client extending BaseAtlassianClient.
 * All Confluence REST v1 operations with auth, retry, rate limiting.
 */
export class ConfluenceApiClient extends BaseAtlassianClient {
  async search(cql: string, start = 0, limit = 25): Promise<HttpResponse> {
    const qs = `cql=${encodeURIComponent(cql)}&start=${start}&limit=${limit}`;
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/search?${qs}` });
  }

  async getPage(pageId: string, expand?: string): Promise<HttpResponse> {
    const qs = expand ? `?expand=${expand}` : '';
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}${qs}` });
  }

  async createPage(body: unknown): Promise<HttpResponse> {
    return this.request({ method: 'POST', path: '/wiki/rest/api/content', body });
  }

  async updatePage(pageId: string, body: unknown): Promise<HttpResponse> {
    return this.request({ method: 'PUT', path: `/wiki/rest/api/content/${pageId}`, body });
  }

  async deletePage(pageId: string): Promise<HttpResponse> {
    return this.request({ method: 'DELETE', path: `/wiki/rest/api/content/${pageId}` });
  }

  async getPageByTitle(spaceKey: string, title: string): Promise<HttpResponse> {
    const qs = `spaceKey=${spaceKey}&title=${encodeURIComponent(title)}`;
    return this.request({ method: 'GET', path: `/wiki/rest/api/content?${qs}` });
  }

  async getChildren(pageId: string, start = 0, limit = 25): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}/child/page?start=${start}&limit=${limit}` });
  }

  async getAncestors(pageId: string): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}?expand=ancestors` });
  }

  async searchContent(query: string, spaceKey?: string, type?: string, start = 0, limit = 25): Promise<HttpResponse> {
    let cql = `text ~ "${query}"`;
    if (spaceKey) cql += ` AND space = "${spaceKey}"`;
    if (type) cql += ` AND type = "${type}"`;
    return this.search(cql, start, limit);
  }

  async getRecent(start = 0, limit = 25): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content?orderby=lastmodified desc&start=${start}&limit=${limit}` });
  }

  async getByLabel(label: string, spaceKey?: string, start = 0, limit = 25): Promise<HttpResponse> {
    let cql = `label = "${label}"`;
    if (spaceKey) cql += ` AND space = "${spaceKey}"`;
    return this.search(cql, start, limit);
  }

  async getSpaces(type?: string, start = 0, limit = 25): Promise<HttpResponse> {
    const typeQs = type ? `&type=${type}` : '';
    return this.request({ method: 'GET', path: `/wiki/rest/api/space?start=${start}&limit=${limit}${typeQs}` });
  }

  async getSpace(spaceKey: string): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/space/${spaceKey}` });
  }

  async getSpaceContent(spaceKey: string, type = 'page', start = 0, limit = 25): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/space/${spaceKey}/content/${type}?start=${start}&limit=${limit}` });
  }

  async addLabel(pageId: string, label: string): Promise<HttpResponse> {
    return this.request({ method: 'POST', path: `/wiki/rest/api/content/${pageId}/label`, body: [{ prefix: 'global', name: label }] });
  }

  async getLabels(pageId: string): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}/label` });
  }

  async getAttachments(pageId: string, start = 0, limit = 25): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}/child/attachment?start=${start}&limit=${limit}` });
  }

  async addAttachment(pageId: string, formData: FormData): Promise<HttpResponse> {
    return this.request({
      method: 'POST', path: `/wiki/rest/api/content/${pageId}/child/attachment`,
      body: formData, isUpload: true,
      headers: { 'X-Atlassian-Token': 'no-check' },
    });
  }

  async getHistory(pageId: string): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}?expand=history` });
  }

  async getVersion(pageId: string, versionNumber: number): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}/version/${versionNumber}` });
  }

  async getComments(pageId: string, start = 0, limit = 25): Promise<HttpResponse> {
    return this.request({ method: 'GET', path: `/wiki/rest/api/content/${pageId}/child/comment?start=${start}&limit=${limit}&expand=body.storage` });
  }

  async addComment(pageId: string, body: unknown): Promise<HttpResponse> {
    return this.request({ method: 'POST', path: '/wiki/rest/api/content', body });
  }
}