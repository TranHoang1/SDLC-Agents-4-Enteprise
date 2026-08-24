export interface CommandContext {
  session: {
    id: string;
    name: string;
    messages: { role: string; content: string }[];
    extendedThinking: boolean;
  };
  runtime: {
    metrics: {
      tokensIn: number;
      tokensOut: number;
      toolCalls: number;
      durationMs: number;
      hookFires: number;
      steeringRules: string[];
    };
    sessionManager: { list: () => any[]; switch: (id: string) => void };
    tools: any[];
    hooks: any[];
    agents: any[];
    steering: any[];
    connection: { ok: boolean };
  };
  clipboard: { write: (text: string) => Promise<void> };
  skillsDir: string;
  invokeSkill: (name: string) => Promise<void>;
}
