import * as vscode from "vscode";
import { PegaHttpClient } from "../services/PegaHttpClient";

export class PegaMcpTools {
  private client: PegaHttpClient;

  constructor(secrets: vscode.SecretStorage) {
    this.client = new PegaHttpClient(secrets);
  }

  public async getSessionContext(): Promise<any> {
    try {
      const ctx = await this.client.getOperatorContext();
      return { success: true, context: ctx };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async getRule(args: Record<string, unknown>): Promise<any> {
    const className = (args.className as string) || "@baseclass";
    const ruleName = (args.ruleName as string) || (args.key as string) || "";
    const projectId = (args.projectId as string) || "DEFAULT_PROJECT";

    const cacheCheck = await this.client.checkBackendCache({
      projectId,
      ruleType: args.ruleType || "Rule-Obj-Activity",
      className,
      ruleName,
    });

    if (cacheCheck.cached) {
      return { success: true, source: "cache", data: cacheCheck.content };
    }

    try {
      const ruleJson = await this.client.getObject(className, ruleName);
      const ingestRes = await this.client.ingestBackendRule({ projectId, ruleJson });

      if (ingestRes.unresolvedDependencies && ingestRes.unresolvedDependencies.length > 0) {
        this.crawlRules(projectId, ingestRes.unresolvedDependencies, new Set<string>());
      }

      return { success: true, source: "pega_studio", data: ruleJson };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async crawlRules(
    projectId: string,
    initialDeps: Array<{ ruleType: string; className: string; ruleName: string }>,
    visited: Set<string>,
  ): Promise<void> {
    const queue: Array<{ ruleType: string; className: string; ruleName: string }> = [...initialDeps];

    while (queue.length > 0) {
      const batch = queue.splice(0, 10);
      const ruleKeys: string[] = [];

      for (const dep of batch) {
        const key = `${dep.ruleType} ${dep.ruleName}`;
        if (visited.has(key)) continue;
        visited.add(key);
        ruleKeys.push(key);
      }

      if (ruleKeys.length === 0) continue;

      const plan = await this.client.crawlPlan({ projectId, ruleKeys, visitedKeys: [...visited] });
      if (plan.missing.length === 0) continue;

      const fetched: Record<string, unknown>[] = [];
      for (const key of plan.missing) {
        try {
          const ruleJson = await this.client.getObject(key.pyClassName, key.pyRuleName);
          fetched.push(ruleJson);
          visited.add(key.insKey);
        } catch {
          visited.add(key.insKey);
        }
      }

      if (fetched.length === 0) continue;

      const result = await this.client.crawlBatch({ projectId, rules: fetched, visitedKeys: [...visited] });
      for (const next of result.nextBatch) {
        if (!visited.has(next.insKey)) {
          queue.push({ ruleType: next.pxObjClass, className: next.pyClassName, ruleName: next.pyRuleName });
        }
      }
    }
  }

  public async crawlProject(args: Record<string, unknown>): Promise<any> {
    const projectId = (args.projectId as string) || "DEFAULT_PROJECT";
    const entryKeys = (args.entryKeys as string[]) || [];
    const maxBatches = (args.maxBatches as number) || 50;

    if (entryKeys.length === 0) {
      return { success: false, error: "entryKeys required — e.g. ['RULE-OBJ-CLASS MyApp-Class']" };
    }

    try {
      const visited = new Set<string>();
      let batchesProcessed = 0;
      let totalStored = 0;
      const queue: string[] = [...entryKeys];

      while (queue.length > 0 && batchesProcessed < maxBatches) {
        const batchKeys = queue.splice(0, 15).filter(k => !visited.has(k));
        if (batchKeys.length === 0) continue;
        batchKeys.forEach(k => visited.add(k));

        const plan = await this.client.crawlPlan({ projectId, ruleKeys: batchKeys, visitedKeys: [...visited] });
        if (plan.missing.length === 0) continue;

        const fetched: Record<string, unknown>[] = [];
        for (const key of plan.missing) {
          try {
            const ruleJson = await this.client.getObject(key.pyClassName, key.pyRuleName);
            fetched.push(ruleJson);
          } catch {
            // rule may not exist on this server
          }
        }

        if (fetched.length === 0) continue;

        const result = await this.client.crawlBatch({ projectId, rules: fetched, visitedKeys: [...visited] });
        totalStored += result.stored;
        batchesProcessed++;

        for (const next of result.nextBatch) {
          if (!visited.has(next.insKey)) {
            queue.push(next.insKey);
          }
        }
      }

      return {
        success: true,
        totalStored,
        batchesProcessed,
        visitedCount: visited.size,
        queueRemaining: queue.length,
        stoppedEarly: queue.length > 0 && batchesProcessed >= maxBatches,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async detectProject(args: Record<string, unknown>): Promise<any> {
    const workspaceRoot = (args.workspaceRoot as string) || "";
    if (!workspaceRoot) {
      return { success: false, error: "workspaceRoot required" };
    }
    try {
      const info = await this.client.detectProject(workspaceRoot);
      return { success: true, ...info };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
