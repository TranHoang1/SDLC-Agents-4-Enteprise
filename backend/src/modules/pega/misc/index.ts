import { PegaMiscParser } from './PegaMiscParser.js';
import { PegaParserRegistry } from '../strategies/PegaParserRegistry.js';

export function registerMiscParsers(registry: PegaParserRegistry): PegaMiscParser {
  const parser = new PegaMiscParser();
  registry.registerStrategy(parser);
  return parser;
}

export type {
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

export { PegaMiscParser };