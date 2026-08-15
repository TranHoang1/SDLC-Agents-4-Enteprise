/**
 * KSA-162 — Unit tests for EventDetector event/scheduled handler detection.
 */

import { describe, it, expect } from 'vitest';
import { EventDetector } from '../detectors/EventDetector.js';

describe('EventDetector', () => {
  const detector = new EventDetector();

  it('detects event handlers from decorators and extracts the event name', () => {
    const symbols = [
      { id: 1, name: 'handleOrder', decorators: ['@EventHandler("order.created")'], filePath: 'app.ts', startLine: 1 },
    ];
    const result = detector.detect(symbols, '');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      entry_type: 'EVENT_HANDLER',
      event_name: 'order.created',
      confidence: 'Medium',
    });
  });

  it('detects scheduled handlers from @Scheduled decorators', () => {
    const symbols = [
      { id: 2, name: 'tick', decorators: ['@Scheduled(cron = "0 0 * * *")'], filePath: 'job.ts', startLine: 1 },
    ];
    const result = detector.detect(symbols, '');
    expect(result[0].entry_type).toBe('SCHEDULED');
  });

  it('detects handlers from surrounding source context', () => {
    const source = [
      'const bus = new EventBus();',
      'bus.on("order.placed", () => {',
      '  handle();',
      '});',
    ].join('\n');
    const symbols = [{ id: 5, name: 'listener', filePath: 'events.ts', startLine: 1 }];
    const result = detector.detect(symbols, source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ entry_type: 'EVENT_HANDLER', event_name: 'order.placed' });
  });

  it('detects subscribe calls as event handlers', () => {
    const source = 'subject.subscribe("email.sent", fn);';
    const symbols = [{ id: 6, name: 'onEmail', filePath: 'mq.ts', startLine: 0 }];
    const result = detector.detect(symbols, source);
    expect(result[0]?.entry_type).toBe('EVENT_HANDLER');
  });

  it('falls back to the symbol name when no event name is extractable', () => {
    const symbols = [{ id: 7, name: 'handleCmd', decorators: ['@EventHandler'], filePath: 'app.ts', startLine: 0 }];
    const result = detector.detect(symbols, '');
    expect(result[0].event_name).toBe('handleCmd');
  });

  it('emits one entry per symbol even with multiple indicators', () => {
    const symbols = [
      { id: 8, name: 'double', decorators: ['@EventHandler("a")', '@Scheduled'], filePath: 'x.ts', startLine: 0 },
    ];
    expect(detector.detect(symbols, '')).toHaveLength(1);
  });

  it('returns empty when nothing matches', () => {
    const symbols = [{ id: 9, name: 'plain', filePath: 'x.ts', startLine: 0 }];
    expect(detector.detect(symbols, 'const a = 1;')).toEqual([]);
  });
});