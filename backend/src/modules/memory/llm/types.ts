/**
 * LLM Provider types — multi-provider support.
 */

export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'lmstudio' | 'copilot';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  tokensUsed?: number;
}

export interface LLMAdapter {
  complete(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;
  isAvailable(config: LLMConfig): Promise<boolean>;
}
