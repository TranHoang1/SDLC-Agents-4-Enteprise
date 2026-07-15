/**
 * ClassifyService — LLM-based semantic evaluation for Smart KB Ingest.
 * Strategy pattern: implements ClassifyStrategy interface.
 * Uses existing LLMService (OllamaAdapter) for local inference.
 */

import type { LLMService } from './LLMService.js';
import type { LLMMessage } from './types.js';

export interface ClassifyResult {
  verdict: 'ingest' | 'skip';
  summary?: string;
}

export interface ClassifyStrategy {
  classify(message: string): Promise<ClassifyResult>;
  isAvailable(): Promise<boolean>;
}

const SYSTEM_PROMPT = `You are a knowledge-base evaluator. Given a user message, decide if it contains valuable business or technical knowledge worth storing.

Respond ONLY with valid JSON (no markdown, no explanation):
{"verdict":"ingest","summary":"<concise summary max 200 chars>"}
or
{"verdict":"skip"}

Rules:
- "ingest" if message contains: architecture decisions, business rules, technical specs, API designs, requirements, lessons learned, configuration details, or domain knowledge.
- "skip" if message is: greetings, chitchat, acknowledgments, simple questions, commands without context, or meta-conversation.`;

export class ClassifyService implements ClassifyStrategy {
  constructor(private readonly llmService: LLMService) {}

  async isAvailable(): Promise<boolean> {
    return this.llmService.isAvailable();
  }

  async classify(message: string): Promise<ClassifyResult> {
    const messages = this.buildPrompt(message);
    const response = await this.llmService.complete(messages);
    return this.parseResponse(response.content);
  }

  buildPrompt(message: string): LLMMessage[] {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ];
  }

  parseResponse(content: string): ClassifyResult {
    try {
      // Extract JSON from potential markdown/thinking wrapper
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) return { verdict: 'skip' };

      const parsed = JSON.parse(jsonMatch[0]);
      const verdict = parsed.verdict === 'ingest' ? 'ingest' : 'skip';
      const summary = typeof parsed.summary === 'string'
        ? parsed.summary.slice(0, 200)
        : undefined;

      return { verdict, summary };
    } catch {
      // Parse failure → treat as unavailable (caller handles fallback)
      throw new Error('llm_parse_error');
    }
  }
}
