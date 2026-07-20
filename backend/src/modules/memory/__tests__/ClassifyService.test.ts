/**
 * Unit Tests — ClassifyService (SA4E-38)
 * Covers: buildPrompt, parseResponse, classify, isAvailable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassifyService } from '../llm/classify-service.js';

function createMockLLMService(response: string, available = true) {
  return {
    complete: vi.fn().mockResolvedValue({ content: response, model: 'test', provider: 'ollama' as const }),
    isAvailable: vi.fn().mockResolvedValue(available),
    getConfig: vi.fn(),
    ask: vi.fn(),
    nameCluster: vi.fn(),
  };
}

describe('ClassifyService', () => {
  describe('buildPrompt', () => {
    it('returns system + user messages', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const messages = svc.buildPrompt('test message');

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('test message');
    });

    it('system prompt contains evaluation instructions', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const messages = svc.buildPrompt('hello');

      expect(messages[0].content).toContain('knowledge-base evaluator');
      expect(messages[0].content).toContain('verdict');
    });
  });

  describe('parseResponse', () => {
    it('parses valid ingest response', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const result = svc.parseResponse('{"verdict":"ingest","summary":"Architecture decision"}');

      expect(result.verdict).toBe('ingest');
      expect(result.summary).toBe('Architecture decision');
    });

    it('parses valid skip response', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const result = svc.parseResponse('{"verdict":"skip"}');

      expect(result.verdict).toBe('skip');
      expect(result.summary).toBeUndefined();
    });

    it('extracts JSON from markdown wrapper', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const result = svc.parseResponse('```json\n{"verdict":"ingest","summary":"test"}\n```');

      expect(result.verdict).toBe('ingest');
      expect(result.summary).toBe('test');
    });

    it('truncates summary to 200 chars', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const longSummary = 'A'.repeat(300);
      const result = svc.parseResponse(`{"verdict":"ingest","summary":"${longSummary}"}`);

      expect(result.summary!.length).toBe(200);
    });

    it('treats unknown verdict as skip', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const result = svc.parseResponse('{"verdict":"unknown"}');

      expect(result.verdict).toBe('skip');
    });

    it('returns skip when no JSON found (no braces)', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);
      const result = svc.parseResponse('I cannot help with that');

      expect(result.verdict).toBe('skip');
    });

    it('throws on malformed JSON with braces', () => {
      const llm = createMockLLMService('{}');
      const svc = new ClassifyService(llm as any);

      expect(() => svc.parseResponse('{invalid json content}'))
        .toThrow('llm_parse_error');
    });
  });

  describe('classify', () => {
    it('calls LLM and returns parsed result', async () => {
      const llm = createMockLLMService('{"verdict":"ingest","summary":"Important decision"}');
      const svc = new ClassifyService(llm as any);

      const result = await svc.classify('We decided to use Strategy pattern');

      expect(llm.complete).toHaveBeenCalledTimes(1);
      expect(result.verdict).toBe('ingest');
      expect(result.summary).toBe('Important decision');
    });

    it('propagates parse errors', async () => {
      const llm = createMockLLMService('{invalid json content}');
      const svc = new ClassifyService(llm as any);

      await expect(svc.classify('test')).rejects.toThrow('llm_parse_error');
    });
  });

  describe('isAvailable', () => {
    it('returns true when LLM is available', async () => {
      const llm = createMockLLMService('{}', true);
      const svc = new ClassifyService(llm as any);

      expect(await svc.isAvailable()).toBe(true);
    });

    it('returns false when LLM is unavailable', async () => {
      const llm = createMockLLMService('{}', false);
      const svc = new ClassifyService(llm as any);

      expect(await svc.isAvailable()).toBe(false);
    });
  });
});
