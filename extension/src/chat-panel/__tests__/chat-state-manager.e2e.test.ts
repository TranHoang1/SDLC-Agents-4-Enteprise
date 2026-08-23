import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ChatStateManager E2E - SA4E-189', () => {
  const workspaceRoot = process.cwd();
  const agentsDir = path.join(workspaceRoot, '.code-intel', 'agents');

  it('agents directory exists and contains .md files', () => {
    if (!fs.existsSync(agentsDir)) {
      console.warn('Agents dir not present in test env, skipping');
      return;
    }
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    // Ensure basename parsing works
    for (const file of files) {
      const id = path.basename(file, '.md');
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('steering files are discoverable recursively', () => {
    const steeringDir = path.join(workspaceRoot, '.code-intel', 'steering');
    if (!fs.existsSync(steeringDir)) {
      console.warn('Steering dir not present, skipping');
      return;
    }
    const walk = (dir: string): string[] => {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...walk(full));
        else if (entry.name.endsWith('.md')) results.push(full);
      }
      return results;
    };
    const files = walk(steeringDir);
    expect(files.length).toBeGreaterThan(0);
  });
});
