/**
 * KSA-162: Event/MQ/Scheduled Handler Detector.
 */

import type { EntryPoint } from '../types.js';

const EVENT_INDICATORS = [
  { pattern: '@EventHandler', type: 'EVENT_HANDLER' as const },
  { pattern: '@Scheduled', type: 'SCHEDULED' as const },
  { pattern: '@Cron', type: 'SCHEDULED' as const },
  { pattern: 'on_event', type: 'EVENT_HANDLER' as const },
  { pattern: '.on(', type: 'EVENT_HANDLER' as const },
  { pattern: '.subscribe(', type: 'EVENT_HANDLER' as const },
  { pattern: '@RabbitListener', type: 'EVENT_HANDLER' as const },
  { pattern: '@KafkaListener', type: 'EVENT_HANDLER' as const },
  { pattern: '@SqsListener', type: 'EVENT_HANDLER' as const },
  { pattern: 'setInterval', type: 'SCHEDULED' as const },
  { pattern: 'cron.schedule', type: 'SCHEDULED' as const },
];

export class EventDetector {
  /** Detect event/scheduled handlers. */
  detect(
    symbols: Array<{ id: number; name: string; decorators?: string[]; filePath: string; startLine: number }>,
    source: string
  ): EntryPoint[] {
    const results: EntryPoint[] = [];

    for (const sym of symbols) {
      const decorators = sym.decorators ?? [];
      const symContext = this.getContext(source, sym.startLine);

      for (const indicator of EVENT_INDICATORS) {
        const found = decorators.some(d => d.includes(indicator.pattern)) ||
                      symContext.includes(indicator.pattern);

        if (found) {
          const eventName = this.extractEventName(decorators, symContext, indicator.pattern);
          results.push({
            symbol_id: sym.id, symbol_name: sym.name,
            file_path: sym.filePath, start_line: sym.startLine,
            entry_type: indicator.type, framework: null,
            http_method: null, route_path: null, full_route: null,
            middleware: [], has_auth: false, controller: null,
            event_name: eventName ?? sym.name, confidence: 'Medium',
          });
          break; // One entry per symbol
        }
      }
    }

    return results;
  }

  private extractEventName(decorators: string[], context: string, pattern: string): string | null {
    for (const dec of decorators) {
      if (dec.includes(pattern)) {
        const match = dec.match(/['"`]([^'"`]+)['"`]/);
        if (match) return match[1];
      }
    }
    const idx = context.indexOf(pattern);
    if (idx >= 0) {
      const after = context.slice(idx + pattern.length);
      const match = after.match(/['"`]([^'"`]+)['"`]/);
      if (match) return match[1];
    }
    return null;
  }

  private getContext(source: string, startLine: number): string {
    const lines = source.split('\n');
    const start = Math.max(0, startLine - 2);
    const end = Math.min(lines.length, startLine + 3);
    return lines.slice(start, end).join('\n');
  }
}
