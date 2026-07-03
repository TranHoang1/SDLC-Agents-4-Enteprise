/**
 * KSA-159: Git Service — wraps git log for file history.
 */

import { execSync } from 'child_process';
import { GitCommit } from './types.js';

export class GitService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /** Get recent commit history for a file. */
  getFileHistory(filePath: string, limit: number = 5): GitCommit[] {
    try {
      const output = execSync(
        `git log --oneline --follow -n ${limit} -- "${filePath}"`,
        { cwd: this.workspaceRoot, encoding: 'utf-8', timeout: 5000 }
      );

      return output.trim().split('\n').filter(Boolean).map(line => {
        const spaceIdx = line.indexOf(' ');
        return {
          hash: line.substring(0, spaceIdx),
          message: line.substring(spaceIdx + 1)
        };
      });
    } catch {
      return []; // Git not available or file not tracked
    }
  }

  /** Check if git is available in the workspace. */
  isAvailable(): boolean {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        timeout: 2000
      });
      return true;
    } catch {
      return false;
    }
  }
}
