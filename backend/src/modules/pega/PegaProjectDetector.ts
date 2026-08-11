import * as fs from 'fs';
import * as path from 'path';

export interface PegaProjectInfo {
  isPegaProject: boolean;
  applicationName?: string;
  rulesetName?: string;
  rulesetVersion?: string;
  pzInsKey?: string;
  sourceDir?: string;
  confidence: number;
  indicators: string[];
}

export class PegaProjectDetector {
  public static detect(workspaceRoot: string): PegaProjectInfo {
    const info: PegaProjectInfo = {
      isPegaProject: false,
      confidence: 0,
      indicators: [],
    };

    const indicators: Array<{ check: string; weight: number; cb: () => void }> = [
      {
        check: 'pega-project.json',
        weight: 60,
        cb: () => {
          const p = path.join(workspaceRoot, 'pega-project.json');
          if (!fs.existsSync(p)) return;
          try {
            const content = JSON.parse(fs.readFileSync(p, 'utf-8'));
            if (content.applicationName) info.applicationName = content.applicationName;
            if (content.rulesetName) info.rulesetName = content.rulesetName;
            if (content.pzInsKey) {
              info.pzInsKey = content.pzInsKey;
            } else if (content.applicationName) {
              info.pzInsKey = `RULE-APPLICATION ${content.applicationName.toUpperCase()}`;
            }
            info.indicators.push('pega-project.json');
          } catch (err) { console.debug('[PegaProjectDetector] skip invalid json :', (err as Error).message); }
        },
      },
      {
        check: 'Application.xml',
        weight: 50,
        cb: () => {
          const p = path.join(workspaceRoot, 'Application.xml');
          if (!fs.existsSync(p)) return;
          const content = fs.readFileSync(p, 'utf-8');
          const nameMatch = content.match(/<application\s+name=['"]([^'"]+)['"]/i);
          const rsMatch = content.match(/ruleset=['"]([^'"]+)['"]/i);
          const keyMatch = content.match(/pzInsKey=['"]([^'"]+)['"]/i);
          if (nameMatch) {
            info.applicationName = nameMatch[1];
            if (!info.pzInsKey) {
              info.pzInsKey = keyMatch ? keyMatch[1] : `RULE-APPLICATION ${nameMatch[1].toUpperCase()}`;
            }
          }
          if (rsMatch) info.rulesetName = rsMatch[1];
          info.indicators.push('Application.xml');
        },
      },
      {
        check: 'application.properties',
        weight: 40,
        cb: () => {
          const p = path.join(workspaceRoot, 'application.properties');
          if (!fs.existsSync(p)) return;
          const content = fs.readFileSync(p, 'utf-8');
          const rsMatch = content.match(/ruleset\.name\s*=\s*(\S+)/);
          const rvMatch = content.match(/ruleset\.version\s*=\s*(\S+)/);
          if (rsMatch) info.rulesetName = rsMatch[1];
          if (rvMatch) info.rulesetVersion = rvMatch[1];
          info.indicators.push('application.properties');
        },
      },
      {
        check: 'META-INF/contents.txt',
        weight: 45,
        cb: () => {
          const p = path.join(workspaceRoot, 'META-INF', 'contents.txt');
          if (!fs.existsSync(p)) return;
          const firstLine = fs.readFileSync(p, 'utf-8').split('\n')[0];
          if (firstLine.includes('Instance Key') || firstLine.includes('RULE-OBJ-')) {
            info.indicators.push('META-INF/contents.txt (Pega export)');
          }
        },
      },
      {
        check: 'src/ directory with .pega files',
        weight: 35,
        cb: () => {
          const srcDir = path.join(workspaceRoot, 'src');
          if (!fs.existsSync(srcDir)) return;
          const entries = fs.readdirSync(srcDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory()) {
              const subDir = path.join(srcDir, e.name);
              const files = fs.readdirSync(subDir);
              if (files.some(f => f.endsWith('.pega'))) {
                info.indicators.push(`src/${e.name}/ (has .pega files)`);
                return;
              }
            }
          }
        },
      },
      {
        check: 'JSON files with pxObjClass',
        weight: 40,
        cb: () => {
          const srcDir = path.join(workspaceRoot, 'src');
          if (!fs.existsSync(srcDir)) return;
          const entries = fs.readdirSync(srcDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory()) {
              const subDir = path.join(srcDir, e.name);
              const files = fs.readdirSync(subDir);
              for (const f of files) {
                if (!f.endsWith('.json')) continue;
                try {
                  const content = JSON.parse(fs.readFileSync(path.join(subDir, f), 'utf-8'));
                  if (content.pxObjClass && content.pxObjClass.startsWith('Rule-')) {
                    info.rulesetName = e.name;
                    info.sourceDir = subDir;
                    info.indicators.push(`JSON with pxObjClass in src/${e.name}/`);
                    return;
                  }
                } catch (err) { console.debug('[PegaProjectDetector] skip :', (err as Error).message); }
              }
            }
          }
        },
      },
      {
        check: '*_rules.jar or *_schema.jar',
        weight: 30,
        cb: () => {
          const files = fs.readdirSync(workspaceRoot);
          for (const f of files) {
            if (f.endsWith('_rules.jar') || f.endsWith('_schema.jar') || f.endsWith('.jar')) {
              info.indicators.push(`${f} (Pega archive)`);
              return;
            }
          }
        },
      },
      {
        check: 'prconfig.xml',
        weight: 25,
        cb: () => {
          const p = path.join(workspaceRoot, 'prconfig.xml');
          if (fs.existsSync(p)) {
            info.indicators.push('prconfig.xml');
          }
        },
      },
      {
        check: 'prpc.properties',
        weight: 20,
        cb: () => {
          const p = path.join(workspaceRoot, 'prpc.properties');
          if (fs.existsSync(p)) {
            info.indicators.push('prpc.properties');
          }
        },
      },
    ];

    for (const indicator of indicators) {
      try {
        indicator.cb();
        info.confidence += indicator.weight;
      } catch (err) { console.debug('[PegaProjectDetector] skip :', (err as Error).message); }
    }

    info.confidence = Math.min(info.confidence, 100);
    info.isPegaProject = info.confidence >= 25;

    return info;
  }
}
