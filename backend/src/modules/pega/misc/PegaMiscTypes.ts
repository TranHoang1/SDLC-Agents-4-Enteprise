export interface MapValue {
  pxObjClass: string;
  pyName: string;
  pySourceProperty?: string;
  pyTargetProperty?: string;
  pyMapRuleSet?: string;
}

export interface FieldValue {
  pxObjClass: string;
  pyName: string;
  pyFieldValue?: string;
  pyClass?: string;
  pyValue?: string;
}

export interface CaseType {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  stages?: StageRef[];
  pyDefaultStage?: string;
  pyStartProcess?: string;
}

export interface StageRef {
  pyName: string;
  pyLabel?: string;
}

export interface Stage {
  pxObjClass: string;
  pyName: string;
  pyLabel?: string;
  pyStageType?: 'Subprocess' | 'Assignment' | 'Approval';
  pyProcesses?: string[];
}

export interface ServiceLevel {
  pxObjClass: string;
  pyName: string;
  pyUrgency?: number;
  pyGoal?: string;
  pyDeadline?: string;
  pyLimit?: string;
  pyAction?: string;
  pyEscalation?: string;
}

export interface Circumstance {
  pxObjClass: string;
  pyName: string;
  pyCircumstanceType?: 'Date' | 'Time' | 'Number' | 'Property';
  pyValue?: string;
  pyTargetProperty?: string;
  pyPriority?: number;
}

export interface Agent {
  pxObjClass: string;
  pyName: string;
  pyType?: 'Queue' | 'JobScheduler';
  pyQueueType?: string;
  pyInterval?: number;
  pyMaxThreads?: number;
}

export interface QueueProcessor {
  pxObjClass: string;
  pyName: string;
  pyClassName?: string;
  pyMaxItems?: number;
}

export interface ReportDef {
  pxObjClass: string;
  pyName: string;
  pyDatasource?: string;
  pyFilters?: ReportFilter[];
  pySortFields?: ReportSortField[];
  pyColumns?: ReportColumn[];
}

export interface ReportFilter {
  pyProperty: string;
  pyOperator: string;
  pyValue: string;
}

export interface ReportSortField {
  pyProperty: string;
  pyOrder: 'ASC' | 'DESC';
}

export interface ReportColumn {
  pyProperty: string;
  pyLabel: string;
  pySortable?: boolean;
}

export interface Correspondence {
  pxObjClass: string;
  pyName: string;
  pyType?: 'Email' | 'Letter' | 'SMS';
  pySubject?: string;
  pyBody?: string;
  pyFromAddress?: string;
}

export interface FileBinary {
  pxObjClass: string;
  pyName: string;
  pyFilePath?: string;
  pyMimeType?: string;
}

export interface FileText {
  pxObjClass: string;
  pyName: string;
  pyContent?: string;
}

export interface EditValidate {
  pxObjClass: string;
  pyName: string;
  pyValidateType?: 'Prompt' | 'List' | 'Table';
  pyClass?: string;
  pyMessage?: string;
}

export interface AutoTest {
  pxObjClass: string;
  pyName: string;
  pyTestScript?: string[];
  pyExpectations?: string[];
}

export interface Utility {
  pxObjClass: string;
  pyName: string;
  pyCode?: string;
  pyLanguage?: 'Java' | 'JS' | 'SQL';
  pyParameters?: string[];
}

export interface Message {
  pxObjClass: string;
  pyName: string;
  pyText?: string;
}

export interface Stream {
  pxObjClass: string;
  pyName: string;
  pyDataSource?: string;
  pyGroups?: string[];
}

export interface Shortcut {
  pxObjClass: string;
  pyName: string;
  pyTarget?: string;
}