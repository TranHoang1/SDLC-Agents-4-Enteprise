export class SlashMenuController {
  private skills: Map<string, string> = new Map();

  registerSkill(skillId: string, description: string) {
    this.skills.set(`/${skillId}`, description);
  }

  getMenuItems(): Array<{ command: string; description: string }> {
    return Array.from(this.skills.entries()).map(([cmd, desc]) => ({ command: cmd, description: desc }));
  }

  invoke(command: string): string | null {
    return this.skills.has(command) ? command : null;
  }
}
