import type { IPegaRuleParserStrategy, ParseResult } from '../strategies/IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';
import type {
  MapValue,
  FieldValue,
  CaseType,
  StageRef,
  Stage,
  ServiceLevel,
  Circumstance,
  Agent,
  QueueProcessor,
  ReportDef,
  ReportFilter,
  ReportSortField,
  ReportColumn,
  Correspondence,
  FileBinary,
  FileText,
  EditValidate,
  AutoTest,
  Utility,
  Message,
  Stream,
  Shortcut,
} from './PegaMiscTypes.js';

const MISC_CLASS_PREFIXES = [
  'Rule-Obj-MapValue',
  'Rule-Obj-FieldValue',
  'Rule-Obj-CaseType',
  'Rule-Obj-Stage',
  'Rule-Obj-ServiceLevel',
  'Rule-Obj-Report-',
  'Rule-Circumstance-',
  'Rule-Agent-',
  'Rule-Corr-',
  'Rule-File-',
  'Rule-Edit-',
  'Rule-Test-',
  'Rule-Utility-',
  'Rule-Message',
  'Rule-Stream',
  'Rule-Shortcut',
];

export class PegaMiscParser implements IPegaRuleParserStrategy {
  public supports(pxObjClass: string): boolean {
    for (const prefix of MISC_CLASS_PREFIXES) {
      if (pxObjClass === prefix) return true;
      if (pxObjClass.startsWith(prefix)) return true;
    }
    return false;
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || '';
    const className = (json.pyClassName as string) || '@baseclass';
    const name = this.extractName(pxObjClass, json);
    const fqn = `${pxObjClass}:${className}:${name}`;
    const dependencies = this.extractDependencies(json);
    const logicSummary = this.buildLogicSummary(pxObjClass, json);

    const symbol = {
      fqn,
      name,
      className,
      ruleType: pxObjClass,
      isRule: true,
      ruleset: (json.pyRuleset as string) || undefined,
      version: (json.pyRulesetVersion as string) || undefined,
      logicSummary,
    };

    return { symbol, dependencies };
  }

  private extractName(pxObjClass: string, json: Record<string, unknown>): string {
    return (json.pyRuleName as string)
      || (json.pyName as string)
      || (json.pyLabel as string)
      || '';
  }

  // ─── Data Rules ───────────────────────────────────────────────────────

  public parseMapValue(json: Record<string, unknown>): MapValue {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Obj-MapValue',
      pyName: this.extractName('', json),
      pySourceProperty: (json.pySourceProperty as string) || undefined,
      pyTargetProperty: (json.pyTargetProperty as string) || undefined,
      pyMapRuleSet: (json.pyMapRuleSet as string) || undefined,
    };
  }

  public parseFieldValue(json: Record<string, unknown>): FieldValue {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Obj-FieldValue',
      pyName: this.extractName('', json),
      pyFieldValue: (json.pyFieldValue as string) || undefined,
      pyClass: (json.pyClass as string) || undefined,
      pyValue: (json.pyValue as string) || undefined,
    };
  }

  // ─── Process Rules ────────────────────────────────────────────────────

  public parseCaseType(json: Record<string, unknown>): CaseType {
    const rawStages = json.pyStages as unknown[];
    const stages: StageRef[] = [];
    if (Array.isArray(rawStages)) {
      for (const raw of rawStages) {
        if (!raw || typeof raw !== 'object') continue;
        const s = raw as Record<string, unknown>;
        stages.push({
          pyName: (s.pyName as string) || '',
          pyLabel: (s.pyLabel as string) || undefined,
        });
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Obj-CaseType',
      pyName: this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
      stages: stages.length > 0 ? stages : undefined,
      pyDefaultStage: (json.pyDefaultStage as string) || undefined,
      pyStartProcess: (json.pyStartProcess as string) || undefined,
    };
  }

  public parseStage(json: Record<string, unknown>): Stage {
    const rawProcesses = json.pyProcesses as unknown[];
    const processes: string[] = [];
    if (Array.isArray(rawProcesses)) {
      for (const raw of rawProcesses) {
        if (typeof raw === 'string') processes.push(raw);
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Obj-Stage',
      pyName: this.extractName('', json),
      pyLabel: (json.pyLabel as string) || undefined,
      pyStageType: (json.pyStageType as 'Subprocess' | 'Assignment' | 'Approval') || undefined,
      pyProcesses: processes.length > 0 ? processes : undefined,
    };
  }

  public parseServiceLevel(json: Record<string, unknown>): ServiceLevel {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Obj-ServiceLevel',
      pyName: this.extractName('', json),
      pyUrgency: json.pyUrgency !== undefined ? Number(json.pyUrgency) : undefined,
      pyGoal: (json.pyGoal as string) || undefined,
      pyDeadline: (json.pyDeadline as string) || undefined,
      pyLimit: (json.pyLimit as string) || undefined,
      pyAction: (json.pyAction as string) || undefined,
      pyEscalation: (json.pyEscalation as string) || undefined,
    };
  }

  // ─── Circumstance Rules ──────────────────────────────────────────────

  public parseCircumstance(json: Record<string, unknown>): Circumstance {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Circumstance-',
      pyName: this.extractName('', json),
      pyCircumstanceType: (json.pyCircumstanceType as 'Date' | 'Time' | 'Number' | 'Property') || undefined,
      pyValue: (json.pyValue as string) || undefined,
      pyTargetProperty: (json.pyTargetProperty as string) || undefined,
      pyPriority: json.pyPriority !== undefined ? Number(json.pyPriority) : undefined,
    };
  }

  // ─── Agent Rules ──────────────────────────────────────────────────────

  public parseAgent(json: Record<string, unknown>): Agent {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Agent-',
      pyName: this.extractName('', json),
      pyType: (json.pyType as 'Queue' | 'JobScheduler') || undefined,
      pyQueueType: (json.pyQueueType as string) || undefined,
      pyInterval: json.pyInterval !== undefined ? Number(json.pyInterval) : undefined,
      pyMaxThreads: json.pyMaxThreads !== undefined ? Number(json.pyMaxThreads) : undefined,
    };
  }

  public parseQueueProcessor(json: Record<string, unknown>): QueueProcessor {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Agent-Queue',
      pyName: this.extractName('', json),
      pyClassName: (json.pyClassName as string) || undefined,
      pyMaxItems: json.pyMaxItems !== undefined ? Number(json.pyMaxItems) : undefined,
    };
  }

  // ─── Report Rules ─────────────────────────────────────────────────────

  public parseReportDef(json: Record<string, unknown>): ReportDef {
    const rawFilters = json.pyFilters as unknown[];
    const filters: ReportFilter[] = [];
    if (Array.isArray(rawFilters)) {
      for (const raw of rawFilters) {
        if (!raw || typeof raw !== 'object') continue;
        const f = raw as Record<string, unknown>;
        filters.push({
          pyProperty: (f.pyProperty as string) || '',
          pyOperator: (f.pyOperator as string) || '',
          pyValue: (f.pyValue as string) || '',
        });
      }
    }

    const rawSortFields = json.pySortFields as unknown[];
    const sortFields: ReportSortField[] = [];
    if (Array.isArray(rawSortFields)) {
      for (const raw of rawSortFields) {
        if (!raw || typeof raw !== 'object') continue;
        const s = raw as Record<string, unknown>;
        sortFields.push({
          pyProperty: (s.pyProperty as string) || '',
          pyOrder: (s.pyOrder as 'ASC' | 'DESC') || 'ASC',
        });
      }
    }

    const rawColumns = json.pyColumns as unknown[];
    const columns: ReportColumn[] = [];
    if (Array.isArray(rawColumns)) {
      for (const raw of rawColumns) {
        if (!raw || typeof raw !== 'object') continue;
        const c = raw as Record<string, unknown>;
        columns.push({
          pyProperty: (c.pyProperty as string) || '',
          pyLabel: (c.pyLabel as string) || '',
          pySortable: c.pySortable !== undefined ? Boolean(c.pySortable) : undefined,
        });
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Obj-Report-',
      pyName: this.extractName('', json),
      pyDatasource: (json.pyDatasource as string) || undefined,
      pyFilters: filters.length > 0 ? filters : undefined,
      pySortFields: sortFields.length > 0 ? sortFields : undefined,
      pyColumns: columns.length > 0 ? columns : undefined,
    };
  }

  // ─── Correspondence ──────────────────────────────────────────────────

  public parseCorrespondence(json: Record<string, unknown>): Correspondence {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Corr-',
      pyName: this.extractName('', json),
      pyType: (json.pyType as 'Email' | 'Letter' | 'SMS') || undefined,
      pySubject: (json.pySubject as string) || undefined,
      pyBody: (json.pyBody as string) || undefined,
      pyFromAddress: (json.pyFromAddress as string) || undefined,
    };
  }

  // ─── File Rules ───────────────────────────────────────────────────────

  public parseFileBinary(json: Record<string, unknown>): FileBinary {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-File-Binary',
      pyName: this.extractName('', json),
      pyFilePath: (json.pyFilePath as string) || undefined,
      pyMimeType: (json.pyMimeType as string) || undefined,
    };
  }

  public parseFileText(json: Record<string, unknown>): FileText {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-File-Text',
      pyName: this.extractName('', json),
      pyContent: (json.pyContent as string) || undefined,
    };
  }

  // ─── Edit Rules ──────────────────────────────────────────────────────

  public parseEditValidate(json: Record<string, unknown>): EditValidate {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Edit-Validate',
      pyName: this.extractName('', json),
      pyValidateType: (json.pyValidateType as 'Prompt' | 'List' | 'Table') || undefined,
      pyClass: (json.pyClass as string) || undefined,
      pyMessage: (json.pyMessage as string) || undefined,
    };
  }

  // ─── Test Rules ──────────────────────────────────────────────────────

  public parseAutoTest(json: Record<string, unknown>): AutoTest {
    const rawScript = json.pyTestScript as unknown[];
    const script: string[] = [];
    if (Array.isArray(rawScript)) {
      for (const raw of rawScript) {
        if (typeof raw === 'string') script.push(raw);
      }
    }

    const rawExpectations = json.pyExpectations as unknown[];
    const expectations: string[] = [];
    if (Array.isArray(rawExpectations)) {
      for (const raw of rawExpectations) {
        if (typeof raw === 'string') expectations.push(raw);
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Test-AutoTest',
      pyName: this.extractName('', json),
      pyTestScript: script.length > 0 ? script : undefined,
      pyExpectations: expectations.length > 0 ? expectations : undefined,
    };
  }

  // ─── Utility Rules ───────────────────────────────────────────────────

  public parseUtility(json: Record<string, unknown>): Utility {
    const rawParams = json.pyParameters as unknown[];
    const parameters: string[] = [];
    if (Array.isArray(rawParams)) {
      for (const raw of rawParams) {
        if (typeof raw === 'string') parameters.push(raw);
      }
    }

    const langRaw = (json.pyLanguage as string) || '';
    let language: 'Java' | 'JS' | 'SQL' | undefined;
    if (langRaw === 'Java' || langRaw === 'JS' || langRaw === 'SQL') {
      language = langRaw;
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Utility-',
      pyName: this.extractName('', json),
      pyCode: (json.pyCode as string) || undefined,
      pyLanguage: language,
      pyParameters: parameters.length > 0 ? parameters : undefined,
    };
  }

  // ─── Other Rules ────────────────────────────────────────────────────

  public parseMessage(json: Record<string, unknown>): Message {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Message',
      pyName: this.extractName('', json),
      pyText: (json.pyText as string) || undefined,
    };
  }

  public parseStream(json: Record<string, unknown>): Stream {
    const rawGroups = json.pyGroups as unknown[];
    const groups: string[] = [];
    if (Array.isArray(rawGroups)) {
      for (const raw of rawGroups) {
        if (typeof raw === 'string') groups.push(raw);
      }
    }

    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Stream',
      pyName: this.extractName('', json),
      pyDataSource: (json.pyDataSource as string) || undefined,
      pyGroups: groups.length > 0 ? groups : undefined,
    };
  }

  public parseShortcut(json: Record<string, unknown>): Shortcut {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Shortcut',
      pyName: this.extractName('', json),
      pyTarget: (json.pyTarget as string) || undefined,
    };
  }

  // ─── Dependencies ─────────────────────────────────────────────────────

  private extractDependencies(json: Record<string, unknown>): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const className = (json.pyClassName as string) || '@baseclass';

    const startProcess = json.pyStartProcess as string;
    if (startProcess) {
      deps.push({ ruleType: 'Rule-Obj-Activity', className, ruleName: startProcess });
    }

    const processes = json.pyProcesses as unknown[];
    if (Array.isArray(processes)) {
      for (const raw of processes) {
        if (typeof raw === 'string' && raw.trim()) {
          deps.push({ ruleType: 'Rule-Obj-Activity', className, ruleName: raw.trim() });
        }
      }
    }

    const mapRuleSet = json.pyMapRuleSet as string;
    if (mapRuleSet) {
      deps.push({ ruleType: 'Rule-Obj-MapValue', className, ruleName: mapRuleSet });
    }

    const targetProperty = json.pyTargetProperty as string;
    if (targetProperty) {
      deps.push({ ruleType: 'Rule-Obj-FieldValue', className, ruleName: targetProperty });
    }

    const datasource = json.pyDatasource as string;
    if (datasource) {
      deps.push({ ruleType: 'Rule-Obj-Report-', className, ruleName: datasource });
    }

    return deps;
  }

  // ─── Logic Summary ────────────────────────────────────────────────────

  private buildLogicSummary(pxObjClass: string, json: Record<string, unknown>): string {
    const lines: string[] = [];
    lines.push(`${pxObjClass}: ${this.extractName(pxObjClass, json)}`);

    if (pxObjClass === 'Rule-Obj-MapValue' || pxObjClass.startsWith('Rule-Obj-MapValue')) {
      const src = (json.pySourceProperty as string) || '(not set)';
      const tgt = (json.pyTargetProperty as string) || '(not set)';
      lines.push(`  Source: ${src} -> Target: ${tgt}`);
    } else if (pxObjClass === 'Rule-Obj-FieldValue' || pxObjClass.startsWith('Rule-Obj-FieldValue')) {
      const val = (json.pyFieldValue as string) || (json.pyValue as string) || '(not set)';
      lines.push(`  Field Value: ${val}`);
    } else if (pxObjClass === 'Rule-Obj-CaseType' || pxObjClass.startsWith('Rule-Obj-CaseType')) {
      const stages = json.pyStages as unknown[];
      lines.push(`  Stages: ${Array.isArray(stages) ? stages.length : 0}`);
      const startProc = (json.pyStartProcess as string);
      if (startProc) lines.push(`  Start Process: ${startProc}`);
    } else if (pxObjClass === 'Rule-Obj-Stage' || pxObjClass.startsWith('Rule-Obj-Stage')) {
      const stType = (json.pyStageType as string) || '(not set)';
      lines.push(`  Stage Type: ${stType}`);
    } else if (pxObjClass === 'Rule-Obj-ServiceLevel' || pxObjClass.startsWith('Rule-Obj-ServiceLevel')) {
      const urgency = json.pyUrgency;
      lines.push(`  Urgency: ${urgency !== undefined ? urgency : '(not set)'}`);
      const goal = (json.pyGoal as string);
      if (goal) lines.push(`  Goal: ${goal}`);
      const deadline = (json.pyDeadline as string);
      if (deadline) lines.push(`  Deadline: ${deadline}`);
    } else if (pxObjClass.startsWith('Rule-Circumstance-')) {
      const ct = (json.pyCircumstanceType as string) || '(not set)';
      lines.push(`  Type: ${ct}`);
      const val = (json.pyValue as string);
      if (val) lines.push(`  Value: ${val}`);
    } else if (pxObjClass.startsWith('Rule-Agent-')) {
      const agentType = (json.pyType as string) || '(not set)';
      lines.push(`  Agent Type: ${agentType}`);
      const interval = json.pyInterval;
      if (interval !== undefined) lines.push(`  Interval: ${interval}s`);
    } else if (pxObjClass.startsWith('Rule-Obj-Report-')) {
      const ds = (json.pyDatasource as string) || '(not set)';
      lines.push(`  Datasource: ${ds}`);
    } else if (pxObjClass.startsWith('Rule-Corr-')) {
      const subj = (json.pySubject as string);
      if (subj) lines.push(`  Subject: ${subj}`);
    } else if (pxObjClass.startsWith('Rule-File-')) {
      const fp = (json.pyFilePath as string);
      if (fp) lines.push(`  File Path: ${fp}`);
    } else if (pxObjClass.startsWith('Rule-Edit-')) {
      const vt = (json.pyValidateType as string) || '(not set)';
      lines.push(`  Validate Type: ${vt}`);
    } else if (pxObjClass.startsWith('Rule-Test-')) {
      const script = json.pyTestScript as unknown[];
      lines.push(`  Test Steps: ${Array.isArray(script) ? script.length : 0}`);
    } else if (pxObjClass.startsWith('Rule-Utility-')) {
      const lang = (json.pyLanguage as string) || '(not set)';
      lines.push(`  Language: ${lang}`);
    } else if (pxObjClass === 'Rule-Message') {
      const text = (json.pyText as string) || '';
      lines.push(`  Text: ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`);
    } else if (pxObjClass === 'Rule-Stream') {
      const ds = (json.pyDataSource as string) || '(not set)';
      lines.push(`  Source: ${ds}`);
    } else if (pxObjClass === 'Rule-Shortcut') {
      const target = (json.pyTarget as string) || '(not set)';
      lines.push(`  Target: ${target}`);
    }

    return lines.join('\n');
  }
}