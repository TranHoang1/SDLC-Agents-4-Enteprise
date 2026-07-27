export type FunctionDefinition = {
  name: string;
  minArgs: number;
  maxArgs: number;
  description: string;
};

const BUILTIN_FUNCTIONS: FunctionDefinition[] = [
  { name: '@round', minArgs: 1, maxArgs: 2, description: 'Round numeric value' },
  { name: '@upper', minArgs: 1, maxArgs: 1, description: 'Uppercase string' },
  { name: '@lower', minArgs: 1, maxArgs: 1, description: 'Lowercase string' },
  { name: '@CurrentDate', minArgs: 0, maxArgs: 0, description: 'Current date/time' },
  { name: '@If', minArgs: 3, maxArgs: 3, description: 'Conditional' },
  { name: '@IsNull', minArgs: 1, maxArgs: 1, description: 'Null check' },
  { name: '@Length', minArgs: 1, maxArgs: 1, description: 'String length' },
  { name: '@Concat', minArgs: 1, maxArgs: 10, description: 'String concatenation' },
  { name: '@Substring', minArgs: 2, maxArgs: 3, description: 'Substring extraction' },
  { name: '@Index', minArgs: 2, maxArgs: 2, description: 'Index of substring' },
];

export class PegaFunctionWhitelist {
  private functions = new Map<string, FunctionDefinition>();

  constructor() {
    for (const fn of BUILTIN_FUNCTIONS) {
      this.functions.set(fn.name, fn);
    }
  }

  isAllowed(name: string): boolean {
    return this.functions.has(name);
  }

  getDefinition(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  getAllowedFunctions(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }

  registerCustomFunction(fn: FunctionDefinition): void {
    if (this.functions.has(fn.name)) {
      throw new Error(`Function '${fn.name}' is already registered`);
    }
    this.functions.set(fn.name, fn);
  }

  validateArgs(name: string, argCount: number): void {
    const fn = this.functions.get(name);
    if (!fn) {
      throw new Error(`Function '${name}' is not whitelisted`);
    }
    if (argCount < fn.minArgs || argCount > fn.maxArgs) {
      throw new Error(
        `Function '${name}' expects ${fn.minArgs}-${fn.maxArgs} arguments, got ${argCount}`,
      );
    }
  }
}
