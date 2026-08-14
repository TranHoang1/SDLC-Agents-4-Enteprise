/**
 * PegaSchemaGenerator — Generates JSON Schema from Pega class via API + Browser.
 * SA4E-95: Combines /rules/query API (OOP resolution) with browser design canvas.
 *
 * Flow:
 * 1. Open section in browser → extract fields, cell props, layout props
 * 2. For each property: resolve type/pageClass via /rules/query API
 * 3. For PageList with flow action: recurse into nested section
 * 4. Output: JSON Schema with full property tree
 */

import type { PegaBrowserInspector, CellPropertyBinding, LayoutPropertyInfo, RenderedFieldInfo } from "./PegaBrowserInspector";

/** JSON Schema property definition */
export interface SchemaProperty {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  pegaType: string;
  pageClass?: string;
  label?: string;
  required: boolean;
  items?: SchemaNode;
  properties?: SchemaNode;
}

/** JSON Schema node (class-level) */
export interface SchemaNode {
  className: string;
  sectionName?: string;
  properties: SchemaProperty[];
}

/** Complete schema generation result */
export interface SchemaGenerationResult {
  rootClass: string;
  schema: SchemaNode;
  metadata: {
    totalProperties: number;
    totalSections: number;
    depth: number;
    generatedAt: string;
    durationMs: number;
  };
}

/** Configuration for schema generator */
export interface SchemaGeneratorConfig {
  pegaEndpoint: string;
  username: string;
  password: string;
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 3;

/**
 * Generates JSON Schema from Pega class definition + browser inspection.
 */
export class PegaSchemaGenerator {
  private authHeader: string;
  private baseUrl: string;
  private visitedClasses = new Set<string>();
  private sectionCache = new Map<string, SchemaNode>();
  private propertyCache = new Map<string, SchemaProperty>();
  private sectionCount = 0;
  private propertyCount = 0;
  private maxDepth: number;

  constructor(
    private readonly config: SchemaGeneratorConfig,
    private readonly inspector: PegaBrowserInspector | null,
    private readonly log: (msg: string) => void,
  ) {
    this.baseUrl = config.pegaEndpoint.replace(/\/PRServlet$/, "").replace(/\/prweb$/, "");
    this.authHeader = "Basic " + Buffer.from(
      `${config.username}:${config.password}`,
    ).toString("base64");
    this.maxDepth = config.maxDepth || DEFAULT_MAX_DEPTH;
  }

  /** Generate complete JSON schema for a Pega class starting from a section. */
  public async generateFromSection(
    className: string, sectionName: string,
  ): Promise<SchemaGenerationResult> {
    const startTime = Date.now();
    this.visitedClasses.clear();
    this.sectionCache.clear();
    this.propertyCache.clear();
    this.sectionCount = 0;
    this.propertyCount = 0;

    this.log(`[SchemaGen] Generating schema: ${className} / ${sectionName}`);

    const schema = await this.extractAndBuild(className, sectionName, 0);

    return {
      rootClass: className,
      schema,
      metadata: {
        totalProperties: this.propertyCount,
        totalSections: this.sectionCount,
        depth: this.maxDepth,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
    };
  }

  /** Generate complete JSON schema for ALL sections of a Pega class. */
  public async generateFromClass(className: string): Promise<SchemaGenerationResult> {
    const startTime = Date.now();
    this.visitedClasses.clear();
    this.sectionCache.clear();
    this.propertyCache.clear();
    this.sectionCount = 0;
    this.propertyCount = 0;

    this.log(`[SchemaGen] Generating FULL schema for class: ${className}`);

    // Step 1: List all sections via API
    const sectionNames = await this.listSectionsForClass(className);
    this.log(`[SchemaGen] Found ${sectionNames.length} sections for ${className}`);

    // Step 2: Process each section, merge properties (limit for sequential test)
    const limit = sectionNames.length; // No limit — process all
    const allProperties: SchemaProperty[] = [];
    const seenProps = new Set<string>();

    for (let i = 0; i < Math.min(limit, sectionNames.length); i++) {
      const name = sectionNames[i];
      this.log(`[SchemaGen] [${i + 1}/${sectionNames.length}] ${name}`);

      try {
        const node = await this.extractAndBuild(className, name, 0);
        for (const prop of node.properties) {
          if (!seenProps.has(prop.name)) {
            seenProps.add(prop.name);
            allProperties.push(prop);
          }
        }
      } catch (err: any) {
        this.log(`[SchemaGen]   ⚠️ ${name}: ${err.message}`);
      }
    }

    const schema: SchemaNode = { className, properties: allProperties };

    return {
      rootClass: className,
      schema,
      metadata: {
        totalProperties: allProperties.length,
        totalSections: this.sectionCount,
        depth: this.maxDepth,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
    };
  }

  /** List all section names for a class via /rules/listRules API. */
  private async listSectionsForClass(className: string): Promise<string[]> {
    const sections = new Set<string>();
    let pageIndex = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${this.baseUrl}/prweb/api/CodeIntelligence/v1/rules/listRules`
        + `?ObjClass=Rule-HTML-Section`
        + `&FilterPropName=pyClassName`
        + `&FilterPropValue=${encodeURIComponent(className)}`
        + `&PageSize=50&PageIndex=${pageIndex}`;

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
        });

        if (!resp.ok) break;
        const json = await resp.json() as any;
        const results = json.pxResults || [];

        for (const r of results) {
          const name = r.pyStreamName || r.pyPropertyName || "";
          if (name) sections.add(name);
        }

        hasMore = results.length >= 50;
        pageIndex++;
      } catch (err) {
        break;
      }
    }

    return Array.from(sections);
  }

  /** Extract section via browser + resolve properties via API. */
  private async extractAndBuild(
    className: string, sectionName: string, depth: number,
  ): Promise<SchemaNode> {
    const key = `${className}/${sectionName}`;

    // Check cache first — avoid reopening same section
    const cached = this.sectionCache.get(key);
    if (cached) {
      this.log(`[SchemaGen] ${"  ".repeat(depth)}Cache hit: ${sectionName} (${className})`);
      return cached;
    }

    if (this.visitedClasses.has(key)) {
      return { className, sectionName, properties: [] };
    }
    this.visitedClasses.add(key);
    this.sectionCount++;

    this.log(`[SchemaGen] ${"  ".repeat(depth)}Section: ${sectionName} (${className})`);

    // Step 0: Resolve rule via API and fetch full rule JSON
    let ruleData: any = null;
    let actualClass = className;
    let ruleKey = "";

    try {
      const resolved = await this.resolveAndFetchRule(className, sectionName);
      if (resolved) {
        ruleData = resolved.ruleData;
        actualClass = resolved.actualClass;
        ruleKey = resolved.ruleKey;
      }
    } catch (err: any) {
      this.log(`[SchemaGen] ${"  ".repeat(depth)}  ⚠️ Rule fetch: ${err.message}`);
    }

    // Step 1: Detect view type and extract fields
    let fields: RenderedFieldInfo[] = [];
    let cells: CellPropertyBinding[] = [];
    let layouts: LayoutPropertyInfo[] = [];

    const viewType = this.detectViewType(ruleData);
    this.log(`[SchemaGen] ${"  ".repeat(depth)}  View: ${viewType}`);

    if (viewType === "simple" && ruleData) {
      // Simple view (Design Template) — extract from pySections JSON directly
      fields = this.extractFromPySections(ruleData, sectionName);
      this.log(`[SchemaGen] ${"  ".repeat(depth)}  JSON: ${fields.length} fields`);

    } else if (viewType === "non-auto" && ruleData) {
      // Non-auto-generated — parse pySourceStream
      fields = this.parseSourceStreamContent(ruleData.pySourceStream || "", sectionName);
      this.log(`[SchemaGen] ${"  ".repeat(depth)}  SourceStream: ${fields.length} fields`);

    } else if (this.inspector) {
      // Complex view — use browser
      try {
        if (!ruleKey) {
          const resolvedRule = await this.inspector.resolveRule(
            "Rule-HTML-Section", className, sectionName,
          );
          actualClass = resolvedRule?.pyClassName || className;
          ruleKey = resolvedRule?.pzInsKey
            || `RULE-HTML-SECTION ${className.toUpperCase()} ${sectionName.toUpperCase()} #20230101T000000.000 GMT`;
        }

        const result = await this.inspector.inspectHarness(actualClass, ruleKey);
        fields = result.renderedFields;
        cells = await this.inspector.extractCellProperties();
        layouts = await this.inspector.extractLayoutProperties();

        this.log(`[SchemaGen] ${"  ".repeat(depth)}  Browser: ${fields.length}F ${cells.length}C ${layouts.length}L`);
      } catch (err: any) {
        this.log(`[SchemaGen] ${"  ".repeat(depth)}  ⚠️ Browser: ${err.message}`);
      }

      // Fallback: if browser found nothing, try pySourceStream
      if (fields.length === 0 && cells.length === 0 && ruleData) {
        const sourceProps = this.parseSourceStreamContent(ruleData.pySourceStream || "", sectionName);
        if (sourceProps.length > 0) {
          this.log(`[SchemaGen] ${"  ".repeat(depth)}  Fallback SourceStream: ${sourceProps.length} props`);
          fields = sourceProps;
        }
      }
    }

    // Step 2: Build properties from browser results
    const properties: SchemaProperty[] = [];
    const seen = new Set<string>();

    // From design canvas fields (PageList, text, etc.)
    for (const f of fields) {
      if (seen.has(f.fieldName)) continue;
      seen.add(f.fieldName);

      // Section includes — recursively process embedded section
      if (f.inputType === "SectionInclude") {
        this.log(`[SchemaGen] ${"  ".repeat(depth)}  ↳ Section include: ${f.fieldName}`);
        if (depth < this.maxDepth) {
          const nestedNode = await this.extractAndBuild(className, f.fieldName, depth + 1);
          for (const np of nestedNode.properties) {
            if (!seen.has(np.name)) {
              seen.add(np.name);
              properties.push(np);
            }
          }
        }
        continue;
      }

      const prop = await this.resolveProperty(className, f.fieldName, depth);
      if (prop) {
        prop.label = f.label;
        if (f.required) prop.required = true;
        properties.push(prop);
      }
    }

    // From cell properties (field bindings from dblclick)
    for (const c of cells) {
      const name = c.labelFor.replace(/^\./, "");
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const prop = await this.resolveProperty(className, name, depth);
      if (prop) {
        prop.label = c.headerText;
        properties.push(prop);
      }
    }

    // From layout properties (table source = PageList)
    // May already exist from fields loop — merge flow action recursion
    for (const l of layouts) {
      const name = l.listGroup.replace(/^\./, "");
      if (!name) continue;

      let prop = properties.find((p) => p.name === name);
      if (!prop) {
        const resolved = await this.resolveProperty(className, name, depth);
        if (resolved) { prop = resolved; properties.push(prop); }
      }

      if (prop && prop.type === "array" && l.detailFlowAction && !prop.items) {
        const nestedClass = prop.pageClass || className;
        const nested = await this.extractAndBuild(nestedClass, l.detailFlowAction, depth + 1);
        prop.items = nested;
      }
    }

    this.propertyCount += properties.length;
    const node: SchemaNode = { className, sectionName, properties };

    // Cache result for reuse
    this.sectionCache.set(key, node);

    // Close the rule tab in browser (Pega limits open tabs)
    await this.closeCurrentRuleTab();

    return node;
  }

  /** Resolve a single property's type and page class via Pega API. */
  private async resolveProperty(
    className: string, propertyName: string, depth: number,
  ): Promise<SchemaProperty | null> {
    try {
      const url = `${this.baseUrl}/prweb/api/CodeIntelligence/v1/rules/query`
        + `?pxObjClass=Rule-Obj-Property`
        + `&appliesTo=${encodeURIComponent(className)}`
        + `&pyRuleName=${encodeURIComponent(propertyName)}`;

      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
      });

      if (!resp.ok) {
        return { name: propertyName, type: "string", pegaType: "SingleValue", required: false };
      }

      const json = await resp.json() as any;
      const pegaType = json.pyPropertyMode || "SingleValue";
      const pageClass = json.pyPageClass || "";

      return {
        name: propertyName,
        type: this.mapType(pegaType),
        pegaType,
        pageClass: pageClass || undefined,
        required: false,
      };
    } catch (err) {
      return { name: propertyName, type: "string", pegaType: "SingleValue", required: false };
    }
  }

  /**
   * Fetch rule pySourceStream (for non-auto-generated sections) and extract property refs.
   * Parses JSP/HTML source for: <pega:reference name=".propName"/>
   * and tools.getProperty(".propName") patterns.
   */
  private async extractFromSourceStream(
    className: string, sectionName: string, depth: number,
  ): Promise<RenderedFieldInfo[]> {
    try {
      // Step 1: Resolve rule to get pzInsKey
      const resolveUrl = `${this.baseUrl}/prweb/api/CodeIntelligence/v1/rules/query`
        + `?pxObjClass=Rule-HTML-Section`
        + `&appliesTo=${encodeURIComponent(className)}`
        + `&pyRuleName=${encodeURIComponent(sectionName)}`;

      const resolveResp = await fetch(resolveUrl, {
        method: "POST",
        headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
      });
      if (!resolveResp.ok) return [];

      const resolveData = await resolveResp.json() as any;
      const insKey = resolveData.pzInsKey;
      if (!insKey) return [];

      // Check if non-auto-generated
      if (resolveData.pyAutoHTML !== false && resolveData.pyAutoHTML !== "false") {
        return []; // Auto-generated — browser should handle it
      }

      // Step 2: Fetch full rule to get pySourceStream
      const ruleUrl = `${this.baseUrl}/prweb/api/CodeIntelligence/v1/rules/${encodeURIComponent(insKey)}`;
      const ruleResp = await fetch(ruleUrl, {
        method: "GET",
        headers: { Authorization: this.authHeader },
      });
      if (!ruleResp.ok) return [];

      const ruleData = await ruleResp.json() as any;
      const source = ruleData.pySourceStream || "";
      if (!source) return [];

      this.log(`[SchemaGen] ${"  ".repeat(depth)}  Non-auto section: parsing pySourceStream (${source.length} chars)`);

      // Step 3: Parse property references from JSP/HTML source
      const props = new Set<string>();

      // Pattern 1: <pega:reference name=".pyPropertyName"/>
      const pegaRefMatches = source.matchAll(/<pega:reference\s+name=['"]\.([a-zA-Z_]\w*)['"]/g);
      for (const m of pegaRefMatches) { props.add(m[1]); }

      // Pattern 2: tools.getProperty(".pyPropertyName")
      const getPropertyMatches = source.matchAll(/tools\.getProperty\s*\(\s*["']\.([a-zA-Z_]\w*)["']\s*\)/g);
      for (const m of getPropertyMatches) { props.add(m[1]); }

      // Pattern 3: tools.getParamValue / tools.putSaveValue with property ref
      const paramMatches = source.matchAll(/tools\.(?:getParamValue|putSaveValue)\s*\(\s*["']([a-zA-Z_]\w*)["']/g);
      for (const m of paramMatches) {
        // Only include if it looks like a property (not a temp param name like "imgname")
        if (/^(py|px|pz)[A-Z]/.test(m[1])) { props.add(m[1]); }
      }

      // Pattern 4: .pyPropertyName in JSP expressions (getPrimaryPage().getProperty)
      const pagePropertyMatches = source.matchAll(/getProperty\s*\(\s*["']\.([a-zA-Z_]\w*)["']\s*\)/g);
      for (const m of pagePropertyMatches) { props.add(m[1]); }

      // Pattern 5: $save(propName) or property in pega:reference without dot
      const saveMatches = source.matchAll(/\$save\(([a-zA-Z_]\w*)\)/g);
      for (const m of saveMatches) {
        if (/^(py|px|pz)[A-Z]/.test(m[1])) { props.add(m[1]); }
      }

      return Array.from(props).map((name) => ({
        fieldName: name,
        inputType: "text",
        label: undefined,
        required: false,
        sectionContext: `${sectionName} (sourceStream)`,
      }));
    } catch (err: any) {
      this.log(`[SchemaGen] ${"  ".repeat(depth)}  ⚠️ SourceStream: ${err.message}`);
      return [];
    }
  }

  /** Resolve section rule and fetch full JSON in one step. */
  private async resolveAndFetchRule(
    className: string, sectionName: string,
  ): Promise<{ ruleData: any; actualClass: string; ruleKey: string } | null> {
    const resolveUrl = `${this.baseUrl}/prweb/api/CodeIntelligence/v1/rules/query`
      + `?pxObjClass=Rule-HTML-Section`
      + `&appliesTo=${encodeURIComponent(className)}`
      + `&pyRuleName=${encodeURIComponent(sectionName)}`;

    const resolveResp = await fetch(resolveUrl, {
      method: "POST",
      headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
    });
    if (!resolveResp.ok) return null;

    const resolveData = await resolveResp.json() as any;
    const ruleKey = resolveData.pzInsKey || "";
    const actualClass = resolveData.pyClassName || className;
    if (!ruleKey) return null;

    // Fetch full rule JSON
    const ruleUrl = `${this.baseUrl}/prweb/api/CodeIntelligence/v1/rules/${encodeURIComponent(ruleKey)}`;
    const ruleResp = await fetch(ruleUrl, {
      method: "GET",
      headers: { Authorization: this.authHeader },
    });
    if (!ruleResp.ok) return { ruleData: resolveData, actualClass, ruleKey };

    const ruleData = await ruleResp.json() as any;
    return { ruleData, actualClass, ruleKey };
  }

  /** Detect section view type from rule JSON. */
  private detectViewType(ruleData: any): "simple" | "non-auto" | "complex" {
    if (!ruleData) return "complex";
    // Non-auto-generated (raw HTML/JSP)
    if (ruleData.pyAutoHTML === false || ruleData.pyAutoHTML === "false") return "non-auto";
    // Simple view: has pySections with field data (pyValue refs)
    // Works for both Design Template sections AND Smart Layout sections
    if (ruleData.pySections && Array.isArray(ruleData.pySections) && ruleData.pySections.length > 0) {
      // Quick check: does pySections contain any pyValue field references?
      const json = JSON.stringify(ruleData.pySections);
      if (json.includes('"pyValue"') && json.match(/"pyValue"\s*:\s*"\./)) {
        return "simple";
      }
    }
    return "complex";
  }

  /** Extract fields from pySections JSON structure (simple view sections). */
  private extractFromPySections(ruleData: any, sectionName: string): RenderedFieldInfo[] {
    const fields: RenderedFieldInfo[] = [];
    const seen = new Set<string>();

    // Recursive traversal of pySections → pySectionBody → pyTable → pyRows → pyCells
    const traverse = (obj: any) => {
      if (!obj || typeof obj !== "object") return;

      // If this object has pyValue with dot-prefix → it's a field binding
      if (obj.pyValue && typeof obj.pyValue === "string" && obj.pyValue.startsWith(".")) {
        const propName = obj.pyValue.substring(1);
        if (propName && !seen.has(propName)) {
          seen.add(propName);
          fields.push({
            fieldName: propName,
            inputType: obj.pyType || "text",
            label: obj.pyLabelValue || obj.pyCaption || undefined,
            required: obj.pyRequired === "true" || obj.pyRequired === true,
            sectionContext: `${sectionName} (pySections)`,
          });
        }
      }

      // If this object has pyPageListProperty → it's a table/repeat source (PageList)
      if (obj.pyPageListProperty && typeof obj.pyPageListProperty === "string" && obj.pyPageListProperty.startsWith(".")) {
        const propName = obj.pyPageListProperty.substring(1);
        if (propName && !seen.has(propName)) {
          seen.add(propName);
          fields.push({
            fieldName: propName,
            inputType: "PageList",
            label: obj.pyCaption || undefined,
            required: obj.pyRequired === "true" || obj.pyRequired === true,
            sectionContext: `${sectionName} (pySections)`,
          });
        }
      }

      // If this is a section include reference
      if (obj.pySectionName && typeof obj.pySectionName === "string") {
        const secName = obj.pySectionName;
        if (!seen.has(`__section__${secName}`)) {
          seen.add(`__section__${secName}`);
          fields.push({
            fieldName: secName,
            inputType: "SectionInclude",
            required: false,
            sectionContext: "embedded",
          });
        }
      }

      // Recurse into arrays and objects
      if (Array.isArray(obj)) {
        for (const item of obj) traverse(item);
      } else {
        for (const val of Object.values(obj)) {
          if (val && typeof val === "object") traverse(val);
        }
      }
    };

    traverse(ruleData.pySections);
    return fields;
  }

  /** Parse pySourceStream JSP/HTML content for property references. */
  private parseSourceStreamContent(source: string, sectionName: string): RenderedFieldInfo[] {
    if (!source) return [];
    const props = new Set<string>();

    // Pattern 1: <pega:reference name=".pyPropertyName"/>
    const pegaRefMatches = source.matchAll(/<pega:reference\s+name=['"]\.([a-zA-Z_]\w*)['"]/g);
    for (const m of pegaRefMatches) { props.add(m[1]); }

    // Pattern 2: tools.getProperty(".pyPropertyName")
    const getPropertyMatches = source.matchAll(/tools\.getProperty\s*\(\s*["']\.([a-zA-Z_]\w*)["']\s*\)/g);
    for (const m of getPropertyMatches) { props.add(m[1]); }

    // Pattern 3: getPrimaryPage().getProperty(".propName")
    const pagePropertyMatches = source.matchAll(/getProperty\s*\(\s*["']\.([a-zA-Z_]\w*)["']\s*\)/g);
    for (const m of pagePropertyMatches) { props.add(m[1]); }

    // Pattern 4: tools.putSaveValue with py/px/pz prefix
    const paramMatches = source.matchAll(/tools\.(?:getParamValue|putSaveValue)\s*\(\s*["']([a-zA-Z_]\w*)["']/g);
    for (const m of paramMatches) {
      if (/^(py|px|pz)[A-Z]/.test(m[1])) { props.add(m[1]); }
    }

    return Array.from(props).map((name) => ({
      fieldName: name,
      inputType: "text",
      label: undefined,
      required: false,
      sectionContext: `${sectionName} (sourceStream)`,
    }));
  }

  /** Map Pega property type to JSON Schema type. */
  private mapType(pegaType: string): SchemaProperty["type"] {
    switch (pegaType) {
      case "PageList": return "array";
      case "Page": return "object";
      case "Integer": case "Double": case "Decimal": return "number";
      case "Boolean": case "TrueFalse": return "boolean";
      default: return "string";
    }
  }

  /** Close the current rule tab in Pega Dev Studio. */
  private async closeCurrentRuleTab(): Promise<void> {
    if (!this.inspector) return;
    const page = (this.inspector as any).page;
    if (!page) return;

    try {
      const closed = await page.evaluate(() => {
        // Path: ul > li[N] > span > span > table > tbody > tr > td:nth-child(3) > span
        const tabLis = document.querySelectorAll("#workarea ul > li");
        if (tabLis.length <= 2) return "only-home";

        // Find last REAL tab (skip spacer li at end)
        for (let i = tabLis.length - 1; i >= 1; i--) {
          const closeBtn = tabLis[i].querySelector(
            "td:nth-child(3) > span",
          ) as HTMLElement;
          if (closeBtn && closeBtn.offsetParent !== null) {
            closeBtn.click();
            return "closed-li-" + i;
          }
          const ariaClose = tabLis[i].querySelector(
            'span[aria-label="Close this tab"]',
          ) as HTMLElement;
          if (ariaClose) {
            ariaClose.click();
            return "closed-aria-li-" + i;
          }
        }
        return "no-close-found";
      });
      this.log(`[SchemaGen]   Tab close: ${closed}`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) { console.debug('[PegaSchemaGenerator] ignore :', (err as Error).message); }
  }

  /** Convert result to standard JSON Schema format. */
  public toJsonSchema(result: SchemaGenerationResult): object {
    const requiredProps = result.schema.properties
      .filter((p) => p.required)
      .map((p) => p.name);

    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: result.rootClass,
      description: `Pega class schema for ${result.rootClass}`,
      type: "object",
      properties: this.toProps(result.schema),
      ...(requiredProps.length > 0 ? { required: requiredProps } : {}),
      "x-pega-metadata": result.metadata,
    };
  }

  private toProps(node: SchemaNode): object {
    const props: Record<string, object> = {};
    for (const p of node.properties) {
      const sp: any = { type: p.type, description: p.label || p.pegaType };
      if (p.pageClass) sp["x-pega-class"] = p.pageClass;
      if (p.type === "array" && p.items) {
        sp.items = { type: "object", properties: this.toProps(p.items), "x-pega-class": p.items.className };
      }
      if (p.type === "object" && p.properties) {
        sp.properties = this.toProps(p.properties);
        sp["x-pega-class"] = p.properties.className;
      }
      props[p.name] = sp;
    }
    return props;
  }
}
