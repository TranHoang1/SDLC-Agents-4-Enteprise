/**
 * PegaSchemaLoader — Tự động quét đệ quy và nạp tất cả các file JSON Schema mô đun hóa 
 * từ các thư mục con trong backend/src/modules/pega/schemas/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { PegaRuleKbSchema } from './strategies/KbDrivenPegaParserStrategy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PegaSchemaLoader {
  public static loadAllSchemas(): PegaRuleKbSchema[] {
    const schemasDir = path.resolve(__dirname, './schemas');
    const results: PegaRuleKbSchema[] = [];
    if (!fs.existsSync(schemasDir)) return results;

    PegaSchemaLoader.scanDirectory(schemasDir, results);
    return results;
  }

  private static scanDirectory(dir: string, results: PegaRuleKbSchema[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        PegaSchemaLoader.scanDirectory(fullPath, results);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        PegaSchemaLoader.loadSingleFile(fullPath, results);
      }
    }
  }

  private static loadSingleFile(filePath: string, results: PegaRuleKbSchema[]): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.schemas)) {
        for (const item of parsed.schemas) {
          if (item && item.targetClass) results.push(item);
        }
      } else if (parsed && parsed.targetClass) {
        results.push(parsed as PegaRuleKbSchema);
      }
    } catch {
      /* ignore invalid JSON files */
    }
  }
}
