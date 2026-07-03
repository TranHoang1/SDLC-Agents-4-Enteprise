/**
 * KSA-162: CLI Command Detector — Detects CLI command entry points.
 */

import type { EntryPoint } from '../types.js';

const CLI_PATTERNS = [
  { pattern: 'commander', indicator: '.command(' },
  { pattern: 'yargs', indicator: '.command(' },
  { pattern: 'click', indicator: '@click.command' },
  { pattern: 'argparse', indicator: 'add_subparsers' },
  { pattern: 'cobra', indicator: 'cobra.Command' },
  { pattern: 'clap', indicator: '#[command' },
];

export class CLIDetector {
  /** Detect CLI command entry points. */
  detect(
    symbols: Array<{ id: number; name: string; decorators?: string[]; filePath: string; startLine: number }>,
    source: string
  ): EntryPoint[] {
    const results: EntryPoint[] = [];

    // Check if file uses a CLI framework
    const cliFramework = CLI_PATTERNS.find(p => source.includes(p.pattern));
    if (!cliFramework) return [];

    for (const sym of symbols) {
      const decorators = sym.decorators ?? [];
      const isCLI = decorators.some(d => d.includes('command') || d.includes('cli')) ||
                    sym.name.includes('command') || sym.name.includes('cmd') ||
                    sym.name.startsWith('cli_');

      if (isCLI) {
        results.push({
          symbol_id: sym.id, symbol_name: sym.name,
          file_path: sym.filePath, start_line: sym.startLine,
          entry_type: 'CLI_COMMAND', framework: cliFramework.pattern,
          http_method: null, route_path: null, full_route: null,
          middleware: [], has_auth: false, controller: null,
          event_name: sym.name, confidence: 'Medium',
        });
      }
    }

    return results;
  }
}
