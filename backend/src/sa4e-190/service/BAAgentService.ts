import * as fs from 'fs';
import * as path from 'path';
import { defaultConfig } from '../config/AppConfig.js';

export class BAAgentService {
  async generateBRD(ticketKey: string): Promise<string> {
    const outputPath = path.join(defaultConfig.brdOutputDir, 'BRD.md');
    const content = `# Business Requirements Document

## Ticket
${ticketKey}

## Purpose
Placeholder purpose for ${ticketKey}

## Scope
Placeholder scope

## User Stories
1. Story one
2. Story two
3. Story three

## Business Rules
| Rule | Description |
|------|-------------|
| BR-01 | Example |

## Non-Functional Requirements
| Category | Requirement |
|----------|-------------|
| Performance | <60s |
`;
    fs.mkdirSync(defaultConfig.brdOutputDir, { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }
}
