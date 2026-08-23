export interface AgentFrontmatter {
  skills?: string[];
}

export class AgentCompiler {
  compile(frontmatter: AgentFrontmatter, skillContents: Record<string, string>): string {
    const skills = frontmatter.skills ?? [];
    const injected = skills.map(id => skillContents[id] ?? '').join('\n');
    return `System Prompt\n${injected}`;
  }
}
