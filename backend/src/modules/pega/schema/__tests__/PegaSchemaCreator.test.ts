/**
 * SA4E-222 Scope B — Unit tests for PegaSchemaCreator.
 * Verifies on-the-fly schema creation parses nested_logic_paths and stores via
 * SchemaStorageService using the canonical key `pega-schema:{ruleType}` (DISC-1 fix).
 */

import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { PegaSchemaCreator } from '../PegaSchemaCreator.js';
import type { ISchemaStorageService } from '../SchemaStorageService.js';

function makeStorage() {
  return {
    store: vi.fn().mockResolvedValue(7),
    find: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(2),
  } as unknown as ISchemaStorageService & { store: ReturnType<typeof vi.fn> };
}

function makeLlm(content: string) {
  return { complete: vi.fn().mockResolvedValue({ content }) } as any;
}

const LOGGER = pino({ name: 'test', level: 'silent' });

describe('PegaSchemaCreator', () => {
  it('parses nested_logic_paths from LLM output and stores canonical schema', async () => {
    const llmOut = JSON.stringify({
      ruleType: 'Rule-Obj-Flow',
      extraction_hints: { nested_logic_paths: ['pyModelProcess.pyShapes', 'pyStages[].pyProcesses[]'] },
    });
    const storage = makeStorage();
    const creator = new PegaSchemaCreator(makeLlm(llmOut), storage, LOGGER);

    const schema = await creator.createSchemaOnTheFly('Rule-Obj-Flow', '{"pxObjClass":"Rule-Obj-Flow"}');
    expect(schema).not.toBeNull();
    expect(schema!.extraction_hints.nested_logic_paths).toEqual([
      'pyModelProcess.pyShapes',
      'pyStages[].pyProcesses[]',
    ]);

    await creator.storeSchema(schema!);
    expect(storage.store).toHaveBeenCalledTimes(1);
    expect(storage.store).toHaveBeenCalledWith(schema);
  });

  it('returns null (non-fatal) when the LLM output is unparseable', async () => {
    const storage = makeStorage();
    const creator = new PegaSchemaCreator(makeLlm('not json at all'), storage, LOGGER);
    const schema = await creator.createSchemaOnTheFly('Rule-Obj-Flow', 'body');
    expect(schema).toBeNull();
    expect(storage.store).not.toHaveBeenCalled();
  });

  it('handles fenced JSON and defaults missing hint fields', async () => {
    const llmOut = '```json\n{"extraction_hints":{"nested_logic_paths":["pySteps"]}}\n```';
    const storage = makeStorage();
    const creator = new PegaSchemaCreator(makeLlm(llmOut), storage, LOGGER);
    const schema = await creator.createSchemaOnTheFly('Rule-Obj-Activity', 'body');
    expect(schema).not.toBeNull();
    expect(schema!.extraction_hints.nested_logic_paths).toEqual(['pySteps']);
    expect(schema!.extraction_hints.primary_logic_field).toBeNull();
  });
});
