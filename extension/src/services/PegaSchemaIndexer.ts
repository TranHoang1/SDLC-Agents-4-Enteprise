/**
 * PegaSchemaIndexer — Batch generate JSON Schemas from ALL Pega RuleForm harnesses (SA4E-93).
 * Pipeline: Crawl harness list → fetch each harness + sections → backend generates schema → write file.
 */
import type { IndexerHttpClient } from "./IndexerHttpClient";
import type { JsonSchema } from "../models";

type PegaHttpClientType = InstanceType<typeof import("./PegaHttpClient").PegaHttpClient>;
type ProgressReporter = import("vscode").Progress<{ message?: string }>;

export class PegaSchemaIndexer {
    constructor(
        private readonly httpClient: IndexerHttpClient,
        private readonly log: (msg: string) => void,
    ) {}

    /** Generate schemas for all RuleForm harness rule types. */
    async run(
        root: string, report: ProgressReporter,
        pegaClient: PegaHttpClientType,
    ): Promise<string> {
        const { SchemaWriter } = await import("./SchemaWriter");
        const writer = new SchemaWriter();

        report.report({ message: "Crawling Pega RuleForm harnesses..." });
        const harnesses = await this.crawlAllHarnesses(pegaClient);

        if (harnesses.length === 0) {
            return "⚠️ Pega Schema: No RuleForm harnesses found.";
        }

        let success = 0;
        let failed = 0;
        const failures: string[] = [];

        for (let i = 0; i < harnesses.length; i++) {
            const harness = harnesses[i];
            const ruleType = (harness.pyClassName as string) || "";
            if (!ruleType) { failed++; continue; }

            report.report({ message: `[${i + 1}/${harnesses.length}] ${ruleType}...` });

            try {
                const schema = await this.generateForHarness(pegaClient, harness, ruleType);
                await writer.writeSchema(ruleType, schema, root);
                await this.ingestSchemaToKB(ruleType, schema);
                this.log(`[SchemaGen] ✅ Schema written for ${ruleType}`);
                success++;
            } catch (err: any) {
                this.log(`[SchemaGen] ❌ ${ruleType}: ${err.message}`);
                failures.push(ruleType);
                failed++;
            }
        }

        if (failures.length > 0 && failures.length <= 5) {
            this.log(`[SchemaGen] Failed: ${failures.join(", ")}`);
        }
        return `📐 Pega Rule Schemas: Generated ${success} schemas for ${harnesses.length} rule types` +
            (failed > 0 ? ` (${failed} failed)` : "");
    }

    /** Crawl all Rule-HTML-Harness rules with pyStreamName=RuleForm (paginated). */
    private async crawlAllHarnesses(pegaClient: PegaHttpClientType): Promise<Record<string, unknown>[]> {
        const all: Record<string, unknown>[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const resp = await pegaClient.listRulesByFilter(
                "Rule-HTML-Harness", "pyStreamName", "RuleForm", 200, page,
            );
            all.push(...resp.pxResults);
            hasMore = resp.pxMore;
            page++;
        }
        this.log(`[SchemaGen] Crawled ${all.length} harness summaries in ${page - 1} pages.`);
        return all;
    }

    /** Fetch harness + sections, send to backend for schema generation. */
    private async generateForHarness(
        pegaClient: PegaHttpClientType, harness: Record<string, unknown>, ruleType: string,
    ): Promise<JsonSchema> {
        const pzInsKey = harness.pzInsKey as string;
        if (!pzInsKey) { throw new Error("No pzInsKey in harness summary"); }

        const harnessJson = await pegaClient.getRuleByInsKey(pzInsKey);
        const sectionJsons = await this.fetchSections(pegaClient, harnessJson, ruleType);

        const backendUrl = this.httpClient.getBaseUrl();
        const res = await fetch(`${backendUrl}/api/v1/pega/schema/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ harnessJson, sectionJsons, ruleType }),
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            throw new Error(`Backend ${res.status}: ${errBody.substring(0, 200)}`);
        }
        return ((await res.json()) as { schema: JsonSchema }).schema;
    }

    /** Fetch referenced sections from harness JSON. */
    private async fetchSections(
        pegaClient: PegaHttpClientType, harnessJson: Record<string, unknown>, ruleType: string,
    ): Promise<Record<string, Record<string, unknown>>> {
        const result: Record<string, Record<string, unknown>> = {};
        for (const name of this.extractSectionNames(harnessJson)) {
            try {
                const json = await pegaClient.queryRuleByTriple("Rule-HTML-Section", ruleType, name);
                if (json) { result[name] = json; }
            } catch (err) { console.debug('[PegaSchemaIndexer] section not found — non-fatal :', (err as Error).message); }
        }
        return result;
    }

    /** Parse section references from harness JSON (pyTemplateName, pySectionBody). */
    private extractSectionNames(harnessJson: Record<string, unknown>): string[] {
        const names = new Set<string>();
        const raw = JSON.stringify(harnessJson);
        for (const m of raw.matchAll(/"pyTemplateName"\s*:\s*"([^"]+)"/g)) {
            if (m[1] && m[1] !== "undefined" && !m[1].startsWith("pz")) { names.add(m[1]); }
        }
        for (const m of raw.matchAll(/"pySectionBody"\s*:\s*"([^"]+)"/g)) {
            if (m[1] && m[1] !== "undefined") { names.add(m[1]); }
        }
        return Array.from(names);
    }

    /** Ingest schema into KB so agents can use it for rule validation. */
    private async ingestSchemaToKB(ruleType: string, schema: JsonSchema): Promise<void> {
        try {
            const backendUrl = this.httpClient.getBaseUrl();
            const content = JSON.stringify(schema);
            const body = {
                content: `PEGA_SCHEMA | ruleType=${ruleType} | fields=${Object.keys(schema.properties || {}).length} | ${content}`,
                type: "PEGA_RULE",
                source: `pega-schema/${ruleType}`,
                tags: `pega,schema,${ruleType}`,
                scope: "PROJECT",
            };
            await fetch(`${backendUrl}/api/v1/memory/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        } catch (err) {
            // KB ingest failure is non-fatal — file already written
        }
    }
}
