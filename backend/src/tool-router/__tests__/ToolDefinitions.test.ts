/**
 * ToolDefinitions unit tests — built-in tool definition registry.
 */

import { describe, it, expect } from 'vitest';
import { getBuiltinToolDefinitions } from '../ToolDefinitions.js';

describe('getBuiltinToolDefinitions', () => {
  it('returns an empty list (definitions come from modules)', () => {
    expect(getBuiltinToolDefinitions()).toEqual([]);
  });
});