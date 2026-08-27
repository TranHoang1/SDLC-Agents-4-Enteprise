import type { ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship, ParseError } from '../../types.js';
import pino from 'pino';
import { detectMetaType, META_SUFFIXES } from './detectMetaType.js';
import { isSecretElement } from './helpers.js';
import {
  parseFlow, parseObject, parseField, parseLWCMeta, parseAuraMeta,
  parseFlexipage, parsePermissionset, parseProfile, parseLabels, parseTab,
  parseLayout, parseReport, parseDashboard, parseSite, parseResource, parseEmail, parseTestSuite,
} from './parsers/index.js';

const logger = pino({ name: 'salesforce-meta-parser' });

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function pushErr(errors: ParseError[], metaType: string | null, e: unknown): void {
  errors.push({ message: `salesforce-meta [${metaType}] parse failed: ${errMsg(e)}`, line: 1, column: 0 });
  logger.warn({ metaType, error: errMsg(e) }, 'salesforce-meta parse failed');
}

export default class SalesforceMetaParser implements ILanguageParser {
  readonly languageId: string;

  constructor(_parser: any, languageId: string) {
    this.languageId = languageId;
  }

  getSupportedExtensions(): string[] {
    return META_SUFFIXES.map(s => `.${s}-meta.xml`);
  }

  parse(source: string, filePath: string): ParseResult {
    let symbols: ExtractedSymbol[] = [];
    const relationships: ExtractedRelationship[] = [];
    const errors: ParseError[] = [];

    try {
      const metaType = detectMetaType(filePath);
      switch (metaType) {
        case 'flow': try { parseFlow(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'object': try { parseObject(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'field': try { parseField(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'lwc-meta': try { parseLWCMeta(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'aura-meta': try { parseAuraMeta(source, filePath, symbols); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'flexipage': try { parseFlexipage(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'permissionset': try { parsePermissionset(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'profile': try { parseProfile(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'labels': try { parseLabels(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'tab': try { parseTab(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'layout': try { parseLayout(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'report': try { parseReport(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'dashboard': try { parseDashboard(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'site': try { parseSite(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'resource': try { parseResource(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'email': try { parseEmail(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        case 'testSuite': try { parseTestSuite(source, filePath, symbols, relationships); } catch (e) { pushErr(errors, metaType, e); } break;
        default: break;
      }
    } catch (e) {
      pushErr(errors, null, e);
    }

    // F-03: never index secret element names
    symbols = symbols.filter(s => !isSecretElement(s.name));

    return { symbols, relationships, errors };
  }
}
