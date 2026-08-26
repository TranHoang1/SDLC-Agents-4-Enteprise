import fs from 'fs';
import path from 'path';

const root = process.cwd();
const skillsDir = path.join(root, '.opencode', 'skills');

// 1. Load all OpenCode skills
const skills = {};
for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const skillName = d.name;
  const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
  if (!fs.existsSync(skillFile)) continue;
  const raw = fs.readFileSync(skillFile, 'utf8');
  let description = skillName;
  let body = raw;
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end > 0) {
      const fm = raw.slice(3, end).trim();
      const m = fm.match(/description:\s*(.+)/);
      if (m) description = m[1].replace(/^['"]|['"]$/g, '').trim();
      body = raw.slice(end + 4).replace(/^\n+/, '');
    }
  }
  skills[skillName] = { description, body };
}

const skillNames = Object.keys(skills);
console.log(`Loaded ${skillNames.length} OpenCode skills`);

// 2. Per-platform mapping + emit (add-only, never overwrite)
const report = [];

function emitClaudeRule(file, skill) {
  const content = `---\ndescription: ${skill.description}\nalwaysApply: false\n---\n\n${skill.body.trim()}\n`;
  fs.writeFileSync(file, content, 'utf8');
}

function emitGhInstruction(file, skill) {
  const content = `---\nname: '${skill.description}'\ndescription: '${skill.description}'\napplyTo: '**'\n---\n\n${skill.body.trim()}\n`;
  fs.writeFileSync(file, content, 'utf8');
}

function emitCodexInstruction(file, skill) {
  const content = `# ${skill.description}\n\n${skill.body.trim()}\n`;
  fs.writeFileSync(file, content, 'utf8');
}

function exists(p) { return fs.existsSync(p); }

// claude-code: .claude/rules/<name>.md
const ccAlias = { 'drawio-diagrams': 'diagrams' };
const ccRulesDir = path.join(root, 'conversions', 'claude-code', '.claude', 'rules');
for (const name of skillNames) {
  const target = ccAlias[name] || name;
  const file = path.join(ccRulesDir, `${target}.md`);
  if (exists(file)) { continue; }
  fs.mkdirSync(ccRulesDir, { recursive: true });
  emitClaudeRule(file, skills[name]);
  report.push(`claude-code: + .claude/rules/${target}.md`);
}

// github-copilot: .github/instructions/<name>.instructions.md ; patterns -> .github/instructions/patterns/<rest>.instructions.md
const ghAlias = { 'drawio-diagrams': 'diagrams', 'file-writing': 'file-writing-standards' };
const ghInstrDir = path.join(root, 'conversions', 'github-copilot', '.github', 'instructions');
for (const name of skillNames) {
  let rel;
  if (name.startsWith('patterns-')) rel = path.join('patterns', `${name.replace('patterns-', '')}.instructions.md`);
  else rel = `${ghAlias[name] || name}.instructions.md`;
  const file = path.join(ghInstrDir, rel);
  if (exists(file)) { continue; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  emitGhInstruction(file, skills[name]);
  report.push(`github-copilot: + .github/instructions/${rel}`);
}

// codex-openai: instructions/<name>.md ; patterns -> instructions/patterns/<rest>.md
const cxAlias = { 'drawio-diagrams': 'diagrams', 'file-writing': 'file-writing-standards' };
const cxInstrDir = path.join(root, 'conversions', 'codex-openai', 'instructions');
for (const name of skillNames) {
  let rel;
  if (name.startsWith('patterns-')) rel = path.join('patterns', `${name.replace('patterns-', '')}.md`);
  else rel = `${cxAlias[name] || name}.md`;
  const file = path.join(cxInstrDir, rel);
  if (exists(file)) { continue; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  emitCodexInstruction(file, skills[name]);
  report.push(`codex-openai: + instructions/${rel}`);
}

console.log(`Generated ${report.length} new skill files:`);
for (const r of report) console.log('  ' + r);
