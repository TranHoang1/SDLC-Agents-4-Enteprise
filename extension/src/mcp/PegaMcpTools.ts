import * as vscode from "vscode";
import { PegaHttpClient } from "../services/PegaHttpClient";
import { PegaRuleSetResolverService, SaveRuleOptions } from "../services/PegaRuleSetResolverService";

export class PegaMcpTools {
  private client: PegaHttpClient;
  private ruleSetResolver: PegaRuleSetResolverService;

  constructor(secrets: vscode.SecretStorage) {
    this.client = new PegaHttpClient(secrets);
    this.ruleSetResolver = new PegaRuleSetResolverService(this.client);
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
    // Track classes whose hierarchy has already been resolved to avoid duplicate API calls
    const hierarchyResolved = new Set<string>();

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

          // When a class is fetched, resolve its full hierarchy via Pega API
          const className = (ruleJson.pyClassName as string) || key.pyRuleName;
          if (key.pxObjClass === 'Rule-Obj-Class' && className && !hierarchyResolved.has(className)) {
            hierarchyResolved.add(className);
            const parents = await this.client.fetchClassHierarchy(className);
            for (const parent of parents) {
              const parentKey = `Rule-Obj-Class ${parent}`;
              if (!visited.has(parentKey)) {
                queue.push({ ruleType: 'Rule-Obj-Class', className: '@baseclass', ruleName: parent });
              }
            }
          }
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

  /**
   * Service 1 MCP Handler: pega_get_rule
   */
  public async getRuleByInsKey(args: Record<string, unknown>): Promise<any> {
    const insKey = (args.insKey as string) || (args.key as string) || "";
    if (!insKey) return { success: false, error: "insKey parameter required" };
    try {
      const data = await this.client.getRuleByInsKey(insKey);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Service 2 MCP Handler: pega_query_rule
   */
  public async queryRule(args: Record<string, unknown>): Promise<any> {
    const pxObjClass = (args.pxObjClass as string) || (args.className as string) || "";
    const appliesTo = (args.appliesTo as string) || (args.pyClassName as string) || "";
    const pyRuleName = (args.pyRuleName as string) || (args.ruleName as string) || "";
    if (!pxObjClass || !pyRuleName) {
      return { success: false, error: "pxObjClass and pyRuleName required" };
    }
    try {
      const data = await this.client.queryRuleByTriple(pxObjClass, appliesTo, pyRuleName);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Service 3 MCP Handler: pega_list_rules
   */
  public async listRules(args: Record<string, unknown>): Promise<any> {
    const pxObjClass = (args.pxObjClass as string) || (args.className as string) || "Rule-Obj-Activity";
    const pageSize = (args.pageSize as number) || 50;
    const pageIndex = (args.pageIndex as number) || 1;
    try {
      const data = await this.client.listApplicationRules(pxObjClass, "", pageSize, pageIndex);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Service 4 MCP Handler: pega_save_rule
   * Trước khi save: resolve RuleSet context (open version / branch) để xác định đích.
   */
  public async saveRule(args: Record<string, unknown>): Promise<any> {
    const ruleJson = args.ruleJson || args.payload;
    if (!ruleJson) return { success: false, error: "ruleJson payload required" };

    const options: SaveRuleOptions = {
      ticketId: (args.ticketId as string) || (args.crId as string) || "",
      crId: args.crId as string,
      developerShortName: args.developerShortName as string,
      preferBranch: !!args.preferBranch,
    };

    try {
      const payloadObj: Record<string, unknown> =
        typeof ruleJson === "object" ? (ruleJson as Record<string, unknown>) : JSON.parse(String(ruleJson));
      const context = await this.ruleSetResolver.resolveRuleWriteContext(payloadObj);

      let target: { pyRuleSet: string; pyRuleSetVersion: string } = {
        pyRuleSet: context.suggestedTarget.pyRuleSet,
        pyRuleSetVersion: context.suggestedTarget.pyRuleSetVersion,
      };

      // Dùng branch version làm đích khi: user yêu cầu (preferBranch), hoặc
      // không có open ruleset version nào (suggested không phải direct/open-stack hợp lệ).
      const branch = await this.ruleSetResolver.resolveBranchContext(options, target.pyRuleSetVersion);
      if (branch && (options.preferBranch || context.suggestedTarget.source !== "direct")) {
        target = { pyRuleSet: target.pyRuleSet, pyRuleSetVersion: branch.branchVersion };
      }

      const data = await this.client.savePegaRule(payloadObj, target);
      return {
        success: true,
        data,
        context: {
          ruleType: context.ruleType,
          suggestedTarget: context.suggestedTarget,
          branch,
          warnings: context.warnings,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Service 5 MCP Handler: pega_checkout_rule
   * Xác định branch trước khi checkout (checkout vào branch version tương ứng).
   */
  public async checkoutRule(args: Record<string, unknown>): Promise<any> {
    const insKey = (args.insKey as string) || "";
    const action = ((args.action as string) || "CHECKOUT").toUpperCase() as "CHECKOUT" | "CHECKIN" | "UNDOCHECKOUT";
    const comment = args.comment as string;
    if (!insKey) return { success: false, error: "insKey parameter required" };

    const options: SaveRuleOptions = {
      ticketId: (args.ticketId as string) || (args.crId as string) || "",
      crId: args.crId as string,
      developerShortName: args.developerShortName as string,
    };

    try {
      // Xác định branch trước khi checkout (theo CR/ticket nếu có).
      const branch = await this.ruleSetResolver.resolveBranchContext(options);
      const data = await this.client.checkoutPegaRule(insKey, action, comment, branch || undefined);
      return { success: true, data, branch: branch || null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Service 6 MCP Handler: pega_run_tests
   */
  public async runTests(args: Record<string, unknown>): Promise<any> {
    const testSuiteID = (args.testSuiteID as string) || (args.suiteId as string) || "";
    const insKey = (args.insKey as string) || "";
    if (!testSuiteID && !insKey) return { success: false, error: "testSuiteID or insKey required" };
    try {
      const data = await this.client.executeScenarioTestSuite(testSuiteID, insKey);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Service 7 MCP Handler: pega_create_branch
   * Tạo branch version Pega khi không có RuleSet version open (rule base closed).
   * branchName nếu bỏ trống sẽ tự suy ra từ ticketId/crId + developerShortName.
   */
  public async createBranch(args: Record<string, unknown>): Promise<any> {
    const rulesetName = (args.rulesetName as string) || "";
    const baseVersion = (args.baseVersion as string) || "01-01-01";
    if (!rulesetName) return { success: false, error: "rulesetName parameter required" };

    const options: SaveRuleOptions = {
      ticketId: (args.ticketId as string) || (args.crId as string) || "",
      crId: args.crId as string,
      developerShortName: args.developerShortName as string,
    };

    try {
      let branchName = (args.branchName as string) || "";
      if (!branchName) {
        const branch = await this.ruleSetResolver.resolveBranchContext(options, baseVersion);
        if (!branch) {
          return { success: false, error: "branchName required (or provide ticketId/crId to auto-derive)" };
        }
        branchName = branch.branchName;
      }

      const data = await this.client.createPegaBranch(rulesetName, baseVersion, branchName);
      const branchVersion = `${baseVersion}:${branchName}`;
      return {
        success: true,
        data,
        context: { rulesetName, baseVersion, branchName, branchVersion },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

