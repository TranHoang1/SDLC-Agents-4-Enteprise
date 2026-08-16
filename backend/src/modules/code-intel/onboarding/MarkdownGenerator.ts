/**
 * SA4E-166 — MarkdownGenerator: Builds ONBOARDING.md content from metadata.
 * Template-based generation with structured sections per spec:
 * Overview, Architecture, Entry Points, Dependencies, Setup, Module Reference.
 */

import type { ModuleInfo, PackageMetadata } from './models.js';

/** Input data gathered by WorkspaceAnalyzer */
export interface GeneratorInput {
  packageMeta: PackageMetadata | null;
  techStack: string[];
  entryPoints: string[];
  modules: ModuleInfo[];
}

export class MarkdownGenerator {
  /** Generate full ONBOARDING.md content from analyzed metadata */
  generate(input: GeneratorInput): string {
    const sections = [
      this.renderOverview(input),
      this.renderArchitecture(input.modules),
      this.renderEntryPoints(input.entryPoints),
      this.renderDependencies(input.packageMeta),
      this.renderDevSetup(input.packageMeta),
      this.renderModuleReference(input.modules),
    ];
    return sections.join('\n\n---\n\n');
  }

  private renderOverview(input: GeneratorInput): string {
    const name = input.packageMeta?.name || 'Project';
    const desc = input.packageMeta?.description || 'No description available.';
    const stack = input.techStack.length > 0
      ? input.techStack.join(', ')
      : 'Not detected';
    return [
      '# Project Overview',
      '',
      `**Name:** ${name}`,
      `**Purpose:** ${desc}`,
      `**Tech Stack:** ${stack}`,
    ].join('\n');
  }

  private renderArchitecture(modules: ModuleInfo[]): string {
    const lines = ['## Architecture', ''];
    if (modules.length === 0) {
      lines.push('No module structure detected.');
      return lines.join('\n');
    }
    lines.push('| Module | Path | Responsibility |');
    lines.push('|--------|------|----------------|');
    for (const mod of modules) {
      lines.push(`| ${mod.name} | \`${mod.path}\` | ${mod.description} |`);
    }
    return lines.join('\n');
  }

  private renderEntryPoints(entryPoints: string[]): string {
    const lines = ['## Key Entry Points', ''];
    if (entryPoints.length === 0) {
      lines.push('No standard entry points detected.');
      return lines.join('\n');
    }
    for (const ep of entryPoints) {
      lines.push(`- \`${ep}\``);
    }
    return lines.join('\n');
  }

  private renderDependencies(pkg: PackageMetadata | null): string {
    const lines = ['## Dependencies', ''];
    if (!pkg || Object.keys(pkg.dependencies).length === 0) {
      lines.push('No dependencies detected.');
      return lines.join('\n');
    }
    lines.push('| Package | Version |');
    lines.push('|---------|---------|');
    const deps = Object.entries(pkg.dependencies).slice(0, 20);
    for (const [name, version] of deps) {
      lines.push(`| ${name} | ${version} |`);
    }
    if (Object.keys(pkg.dependencies).length > 20) {
      lines.push(`| ... | (${Object.keys(pkg.dependencies).length - 20} more) |`);
    }
    return lines.join('\n');
  }

  private renderDevSetup(pkg: PackageMetadata | null): string {
    const lines = ['## Development Setup', ''];
    if (!pkg || Object.keys(pkg.scripts).length === 0) {
      lines.push('No build scripts detected. Check project documentation.');
      return lines.join('\n');
    }
    lines.push('```bash');
    lines.push('# Install dependencies');
    lines.push('npm install');
    lines.push('');
    const scriptEntries = Object.entries(pkg.scripts);
    for (const [name, cmd] of scriptEntries.slice(0, 10)) {
      lines.push(`# ${name}`);
      lines.push(`npm run ${name}  # ${cmd}`);
    }
    lines.push('```');
    return lines.join('\n');
  }

  private renderModuleReference(modules: ModuleInfo[]): string {
    const lines = ['## Module Reference', ''];
    if (modules.length === 0) {
      lines.push('No modules discovered.');
      return lines.join('\n');
    }
    for (const mod of modules) {
      lines.push(`### ${mod.name}`);
      lines.push(`- **Path:** \`${mod.path}\``);
      lines.push(`- **Description:** ${mod.description}`);
      if (mod.exports.length > 0) {
        lines.push(`- **Exports:** ${mod.exports.join(', ')}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }
}
