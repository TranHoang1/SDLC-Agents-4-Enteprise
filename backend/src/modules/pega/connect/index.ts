import { PegaConnectParser } from './PegaConnectParser.js';
import { PegaParserRegistry } from '../strategies/PegaParserRegistry.js';
import type { PegaConnectRule, PegaConnectHeader, PegaServiceRule, ConnectMethod, ConnectType, AuthType } from './PegaConnectTypes.js';

export function registerConnectParser(registry: PegaParserRegistry): PegaConnectParser {
  const parser = new PegaConnectParser();
  registry.registerStrategy(parser);
  return parser;
}

export type { PegaConnectRule, PegaConnectHeader, PegaServiceRule, ConnectMethod, ConnectType, AuthType };
export { PegaConnectParser };