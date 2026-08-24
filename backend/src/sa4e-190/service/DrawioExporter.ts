import * as fs from 'fs';
import * as path from 'path';
import { defaultConfig } from '../config/AppConfig.js';

export class DrawioExporter {
  async exportDiagram(name: string): Promise<{ drawioPath: string; pngPath: string }> {
    const dir = defaultConfig.diagramsDir;
    fs.mkdirSync(dir, { recursive: true });
    const drawioPath = path.join(dir, `${name}.drawio`);
    const pngPath = path.join(dir, `${name}.png`);
    // Dummy content
    fs.writeFileSync(drawioPath, '<mxfile></mxfile>', 'utf-8');
    // Create empty png placeholder
    if (!fs.existsSync(pngPath)) {
      fs.writeFileSync(pngPath, '', 'utf-8');
    }
    return { drawioPath, pngPath };
  }
}
