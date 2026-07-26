/**
 * E2E Integration Test Suite cho Pega Rule & Data Indexing Pipeline.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createPegaApiRoutes } from '../../../server/routes/pega-api.js';
import { PegaRuleResolver } from '../PegaRuleResolver.js';
import { PegaDeclarativeEngine } from '../PegaDeclarativeEngine.js';
import {
  MOCK_ACTIVITY_JSON,
  MOCK_VALIDATE_DATA_ACTIVITY_JSON,
  MOCK_DATA_TRANSFORM_JSON,
  MOCK_OPERATOR_DATA_JSON,
  MOCK_DECISION_TABLE_JSON,
} from './fixtures/pega-samples.js';

class MockMemoryAdapter {
  private data = new Map<string, { id: number; content: string; updated_at: string }>();
  private idCounter = 1;

  public async getAsync<T>(query: string, params: any[]): Promise<T | null> {
    if (query.includes('FROM knowledge_entries WHERE source')) {
      const source = params[0];
      const found = this.data.get(source);
      return (found as unknown as T) || null;
    }
    return null;
  }

  public async allAsync<T>(query: string, _params: any[]): Promise<T[]> {
    if (query.includes("WHERE type = 'PEGA_SCHEMA'")) {
      const schemas = Array.from(this.data.values())
        .filter((item) => item.content.includes('targetClass'))
        .map((item) => ({ content: item.content }));
      return schemas as unknown as T[];
    }
    return [];
  }

  public async runAsync(query: string, params: any[]): Promise<void> {
    if (query.includes('DELETE FROM knowledge_entries WHERE source')) {
      this.data.delete(params[0]);
    }
  }

  public async insertEntry(content: string, source: string): Promise<number> {
    const id = this.idCounter++;
    this.data.set(source, { id, content, updated_at: new Date().toISOString() });
    return id;
  }
}

class MockMemoryEngine {
  public adapter = new MockMemoryAdapter();

  public getAdapter(): any {
    return this.adapter;
  }

  public async insert(opts: any): Promise<number> {
    return this.adapter.insertEntry(opts.content, opts.source);
  }
}

describe('Pega Indexing E2E Integration Suite', () => {
  let app: Hono;
  let mockEngine: MockMemoryEngine;

  beforeAll(() => {
    mockEngine = new MockMemoryEngine();
    const mockRegistry = {
      getModule: (name: string) => {
        if (name === 'memory') {
          return { status: 'ready', getEngine: () => mockEngine };
        }
        return null;
      },
    } as any;

    const mockLogger = { error: () => {}, info: () => {}, warn: () => {} } as any;
    app = new Hono();
    app.route('/api/v1', createPegaApiRoutes(mockRegistry, mockLogger));
  });

  it('TC-01: Check-rule returns cache miss for un-indexed activity', async () => {
    const res = await app.request('/api/v1/pega/check-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'PEGA_APP_01',
        ruleType: 'Rule-Obj-Activity',
        className: 'Work-Cover-Jira',
        ruleName: 'ResolveTicket',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.cached).toBe(false);
  });

  it('TC-02: Ingest activity extracts symbol & unresolved dependencies', async () => {
    const res = await app.request('/api/v1/pega/ingest-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'PEGA_APP_01',
        ruleJson: MOCK_ACTIVITY_JSON,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('success');
    expect(body.data.unresolvedDependencies.length).toBe(2);
    expect(body.data.unresolvedDependencies[0].ruleName).toBe('ValidateData');
  });

  it('TC-03: Check-rule returns cache hit after ingesting activity', async () => {
    const res = await app.request('/api/v1/pega/check-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'PEGA_APP_01',
        ruleType: 'Rule-Obj-Activity',
        className: 'Work-Cover-Jira',
        ruleName: 'ResolveTicket',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.cached).toBe(true);
    expect(body.data.content.pyActivityName).toBe('ResolveTicket');
  });

  it('TC-04: Ingest dependency activity resolves background queue', async () => {
    const res = await app.request('/api/v1/pega/ingest-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'PEGA_APP_01',
        ruleJson: MOCK_VALIDATE_DATA_ACTIVITY_JSON,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('success');
  });

  it('TC-05: Ingest Data Transform (Rule-Obj-Model)', async () => {
    const res = await app.request('/api/v1/pega/ingest-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'PEGA_APP_01',
        ruleJson: MOCK_DATA_TRANSFORM_JSON,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('success');
    expect(body.data.unresolvedDependencies[0].ruleName).toBe('SetDefaultStatus');
  });

  it('TC-06: Ingest Data instance (Data-Admin-Operator-ID)', async () => {
    const res = await app.request('/api/v1/pega/ingest-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'PEGA_APP_01',
        ruleJson: MOCK_OPERATOR_DATA_JSON,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('success');
  });

  it('TC-07: Upsert dynamic schema via REST API & ingest Decision Table', async () => {
    const schemaRes = await app.request('/api/v1/pega/schemas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetClass: 'Rule-Declare-DecisionTable',
        nameProperty: 'pyLabel',
        dependencyPaths: ['pyPropertyEvaluated', 'pyReturnActions[].pyTransformName'],
      }),
    });
    expect(schemaRes.status).toBe(201);

    const ingestRes = await app.request('/api/v1/pega/ingest-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'PEGA_APP_01',
        ruleJson: MOCK_DECISION_TABLE_JSON,
      }),
    });
    expect(ingestRes.status).toBe(201);
    const body = (await ingestRes.json()) as any;
    expect(body.data.status).toBe('success');
  });

  it('TC-08: Generate Browser UI Automation Plan via POST /api/v1/pega/browser-plan', async () => {
    const planRes = await app.request('/api/v1/pega/browser-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleJson: MOCK_ACTIVITY_JSON }),
    });
    expect(planRes.status).toBe(200);
    const body = (await planRes.json()) as any;
    expect(body.data.ruleFqn).toBe('Rule-Obj-Activity:Work-Cover-Jira:ResolveTicket');
    expect(body.data.uiSteps.length).toBeGreaterThan(0);
    expect(body.data.uiSteps[0].action).toBe('CLICK_ADD_STEP');
  });

  it('TC-09: Verify PegaRuleResolver Pattern Inheritance & Ruleset Stack filtering', () => {
    const candidates = [
      { fqn: 'Rule-Obj-Activity:Work-Cover:ResolveTicket', ruleType: 'Rule-Obj-Activity', className: 'Work-Cover', ruleName: 'ResolveTicket', ruleset: 'JiraIntegration' },
      { fqn: 'Rule-Obj-Activity:Work-Cover-Jira:ResolveTicket', ruleType: 'Rule-Obj-Activity', className: 'Work-Cover-Jira', ruleName: 'ResolveTicket', ruleset: 'JiraIntegration' },
    ];
    const resolved = PegaRuleResolver.resolveRule('Work-Cover-Jira-Ticket', 'ResolveTicket', 'Rule-Obj-Activity', ['JiraIntegration'], candidates);
    expect(resolved).not.toBeNull();
    expect(resolved?.className).toBe('Work-Cover-Jira');
  });

  it('TC-10: Verify PegaDeclarativeEngine Forward and Backward Chaining', () => {
    const engine = new PegaDeclarativeEngine();
    engine.registerExpression('.TaxAmount', '.SubTotal * 0.1', ['.SubTotal']);
    engine.registerExpression('.GrandTotal', '.SubTotal + .TaxAmount', ['.SubTotal', '.TaxAmount']);

    const forwardImpact = engine.findForwardImpact('.SubTotal');
    expect(forwardImpact).toContain('.TaxAmount');
    expect(forwardImpact).toContain('.GrandTotal');

    const backwardDeps = engine.findBackwardDependencies('.GrandTotal');
    expect(backwardDeps).toContain('.TaxAmount');
    expect(backwardDeps).toContain('.SubTotal');
  });
});
