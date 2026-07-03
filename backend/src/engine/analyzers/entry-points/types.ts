/**
 * KSA-162: Entry Point Detection — Type definitions.
 */

export type EntryType = 'HTTP_HANDLER' | 'MAIN' | 'CLI_COMMAND' | 'EVENT_HANDLER' | 'SCHEDULED';

export interface EntryPoint {
  symbol_id: number;
  symbol_name: string;
  file_path: string;
  start_line: number;
  entry_type: EntryType;
  framework: string | null;
  http_method: string | null;
  route_path: string | null;
  full_route: string | null;
  middleware: string[];
  has_auth: boolean;
  controller: string | null;
  event_name: string | null;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface HTTPEntryPoint extends EntryPoint {
  entry_type: 'HTTP_HANDLER';
  http_method: string;
  route_path: string;
  full_route: string;
}

export interface RouteInfo {
  method: string;
  path: string;
  fullRoute: string;
}

export interface FrameworkInfo {
  name: string;
  language: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface EntryPointFilters {
  entryType?: EntryType;
  framework?: string;
  httpMethod?: string;
  routePattern?: string;
  hasAuth?: boolean;
  filePath?: string;
  limit: number;
}

export interface EntryPointQueryResult {
  results: EntryPoint[];
  total: number;
  summary: {
    byType: Record<string, number>;
    byFramework: Record<string, number>;
    authCoverage: { withAuth: number; withoutAuth: number };
  };
}

export interface FrameworkPatterns {
  language: string;
  imports: string[];
  decorators?: { handler: string[]; prefix?: string[] };
  call_patterns?: { handler: string[]; mount?: string[] };
  auth_indicators: string[];
}

export interface PatternConfig {
  frameworks: Record<string, FrameworkPatterns>;
  main_patterns: Record<string, { pattern: string; type: string }>;
}
