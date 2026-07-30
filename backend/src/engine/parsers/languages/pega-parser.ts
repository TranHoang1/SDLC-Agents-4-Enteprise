import type { ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship, ParseError } from '../types.js';
import { PegaRuleAstParser } from '../../../modules/pega/PegaRuleAstParser.js';

const AST_PARSER = new PegaRuleAstParser();

const RULE_NAME_FIELDS = ['pyRuleName', 'pyActivityName', 'pyModelName', 'pyFlowName'];

export default class PegaFileParser implements ILanguageParser {
  readonly languageId = 'pega';

  getSupportedExtensions(): string[] {
    return ['.pega'];
  }

  parse(source: string, filePath: string): ParseResult {
    const errors: ParseError[] = [];
    let json: Record<string, unknown>;

    try {
      json = JSON.parse(source);
    } catch {
      errors.push({ message: 'Invalid JSON in .pega file', line: 1, column: 0 });
      return { symbols: [], relationships: [], errors };
    }

    if (!json || typeof json !== 'object') {
      errors.push({ message: 'Empty or non-object JSON', line: 1, column: 0 });
      return { symbols: [], relationships: [], errors };
    }

    const ruleType = (json.pxObjClass as string) || 'Rule-Obj-Activity';
    const className = (json.pyClassName as string) || '';
    const ruleName = this.extractRuleName(json, filePath);
    const ruleset = (json.pyRuleset as string) || '';
    const rulesetVersion = (json.pyRuleSetVersion as string) || '';

    const signature = JSON.stringify({
      ruleType,
      className,
      ruleset,
      rulesetVersion,
      label: json.pyLabel || '',
    });

    const symbol: ExtractedSymbol = {
      name: ruleName,
      kind: 'pega-rule',
      filePath,
      startLine: 1,
      endLine: 1,
      signature,
      parameters: ruleType,
      docComment: (json.pyDescription as string) || null,
    };

    const relationships = this.extractRelationships(json, className, ruleType, filePath);

    return { symbols: [symbol], relationships, errors };
  }

  private extractRuleName(json: Record<string, unknown>, filePath: string): string {
    for (const field of RULE_NAME_FIELDS) {
      const val = json[field];
      if (typeof val === 'string' && val) return val;
    }
    const base = filePath.replace(/\\/g, '/').split('/').pop() || '';
    return base.replace(/\.pega$/i, '');
  }

  private extractRelationships(
    json: Record<string, unknown>,
    defaultClass: string,
    ruleType: string,
    filePath: string,
  ): ExtractedRelationship[] {
    const rels: ExtractedRelationship[] = [];
    const visited = new Set<string>();

    const ast = AST_PARSER.parse(json);
    for (const ref of ast.references) {
      const targetFile = this.refToFilePath(ref);
      const key = `${ref.role}:${targetFile}`;
      if (visited.has(key)) continue;
      visited.add(key);
      rels.push({
        sourceSymbol: filePath,
        targetSymbol: targetFile,
        kind: 'references',
        filePath,
        line: 1,
        metadata: {
          ruleType: ref.ruleType,
          className: ref.className,
          ruleName: ref.ruleName,
          role: ref.role,
        },
      });
    }

    return rels;
  }

  private refToFilePath(ref: { ruleType: string; className: string; ruleName: string }): string {
    const typePart = ref.ruleType.replace(/-/g, '-');
    const cls = ref.className.replace(/^@/, '');
    return cls ? `${cls}.${ref.ruleName}.${typePart}.pega` : `${ref.ruleName}.${typePart}.pega`;
  }
}
