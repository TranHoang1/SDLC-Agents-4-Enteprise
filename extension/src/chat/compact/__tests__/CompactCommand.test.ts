/**
 * SA4E-182 — CompactCommand unit tests.
 * Tests: delegates to service correctly with current state.
 */

import { describe, it, expect, vi } from 'vitest';
import { CompactCommand } from '../CompactCommand';
import type { CompactService } from '../CompactService';
import type { CompactResult, ChatMessage } from '../types';

describe('CompactCommand', () => {
  it('should delegate to CompactService with manual trigger', async () => {
    const mockResult: CompactResult = {
      success: true,
      method: 'summary',
      summary: 'test',
      beforeUsagePercent: 95,
      afterUsagePercent: 40,
      beforeTokens: 95000,
      afterTokens: 40000,
      messagesRemoved: 8,
      timestamp: new Date().toISOString(),
    };

    const mockService = {
      executeCompact: vi.fn().mockResolvedValue(mockResult),
    } as unknown as CompactService;

    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'assistant', content: 'hello' },
      { id: '3', role: 'user', content: 'code' },
    ];

    const stateProvider = () => ({ threadId: 'thread-abc', chatHistory: messages });
    const command = new CompactCommand(mockService, stateProvider);

    const result = await command.execute();

    expect(mockService.executeCompact).toHaveBeenCalledWith('manual', 'thread-abc', messages);
    expect(result.success).toBe(true);
    expect(result.method).toBe('summary');
  });

  it('should propagate errors from service', async () => {
    const mockService = {
      executeCompact: vi.fn().mockRejectedValue(new Error('Not enough context')),
    } as unknown as CompactService;

    const stateProvider = () => ({ threadId: 't-1', chatHistory: [] });
    const command = new CompactCommand(mockService, stateProvider);

    await expect(command.execute()).rejects.toThrow('Not enough context');
  });
});
