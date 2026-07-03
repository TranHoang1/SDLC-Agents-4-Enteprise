/**
 * KSA-162: Pattern Registry — Manages framework detection patterns.
 */

import type { PatternConfig, FrameworkPatterns } from './types.js';

const DEFAULT_PATTERNS: PatternConfig = {
  frameworks: {
    fastapi: {
      language: 'python',
      imports: ['fastapi', 'from fastapi'],
      decorators: {
        handler: ['app.get', 'app.post', 'app.put', 'app.delete', 'app.patch',
                  'router.get', 'router.post', 'router.put', 'router.delete', 'router.patch'],
        prefix: ['APIRouter(prefix='],
      },
      auth_indicators: ['Depends(get_current_user)', 'Security(', 'Depends(auth'],
    },
    express: {
      language: 'typescript',
      imports: ['express', "from 'express'", 'from "express"'],
      call_patterns: {
        handler: ['app.get', 'app.post', 'app.put', 'app.delete', 'app.patch',
                  'router.get', 'router.post', 'router.put', 'router.delete', 'router.patch'],
        mount: ['app.use'],
      },
      auth_indicators: ['authenticate', 'passport', 'authMiddleware', 'requireAuth'],
    },
    nestjs: {
      language: 'typescript',
      imports: ['@nestjs/common', '@nestjs/core'],
      decorators: {
        handler: ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Head', 'Options', 'All'],
        prefix: ['Controller'],
      },
      auth_indicators: ['UseGuards', 'AuthGuard', '@Auth', 'JwtAuthGuard'],
    },
    spring: {
      language: 'java',
      imports: ['org.springframework.web', 'org.springframework.boot'],
      decorators: {
        handler: ['GetMapping', 'PostMapping', 'PutMapping', 'DeleteMapping', 'PatchMapping', 'RequestMapping'],
        prefix: ['RequestMapping', 'RestController'],
      },
      auth_indicators: ['@PreAuthorize', '@Secured', '@RolesAllowed'],
    },
    ktor: {
      language: 'kotlin',
      imports: ['io.ktor.server', 'io.ktor.routing'],
      call_patterns: {
        handler: ['get(', 'post(', 'put(', 'delete(', 'patch(', 'route('],
        mount: ['routing {', 'install('],
      },
      auth_indicators: ['authenticate(', 'principal', 'jwt {'],
    },
    gin: {
      language: 'go',
      imports: ['github.com/gin-gonic/gin'],
      call_patterns: {
        handler: ['GET(', 'POST(', 'PUT(', 'DELETE(', 'PATCH(', 'Handle('],
        mount: ['Group('],
      },
      auth_indicators: ['AuthMiddleware', 'authRequired', 'JWTAuth'],
    },
  },
  main_patterns: {
    python: { pattern: 'if __name__ == "__main__":', type: 'MAIN' },
    typescript: { pattern: 'process.argv', type: 'MAIN' },
    javascript: { pattern: 'process.argv', type: 'MAIN' },
    java: { pattern: 'public static void main(String', type: 'MAIN' },
    kotlin: { pattern: 'fun main(', type: 'MAIN' },
    go: { pattern: 'func main()', type: 'MAIN' },
  },
};

export class PatternRegistry {
  private config: PatternConfig;

  constructor(customConfig?: Partial<PatternConfig>) {
    this.config = customConfig
      ? { ...DEFAULT_PATTERNS, ...customConfig }
      : DEFAULT_PATTERNS;
  }

  /** Get framework patterns by name. */
  getFramework(name: string): FrameworkPatterns | null {
    return this.config.frameworks[name] ?? null;
  }

  /** Get all framework names. */
  getFrameworkNames(): string[] {
    return Object.keys(this.config.frameworks);
  }

  /** Get frameworks for a specific language. */
  getFrameworksForLanguage(language: string): Array<{ name: string; patterns: FrameworkPatterns }> {
    return Object.entries(this.config.frameworks)
      .filter(([_, p]) => p.language === language)
      .map(([name, patterns]) => ({ name, patterns }));
  }

  /** Get main pattern for a language. */
  getMainPattern(language: string): { pattern: string; type: string } | null {
    return this.config.main_patterns[language] ?? null;
  }

  /** Get all import patterns for framework detection. */
  getAllImportPatterns(): Array<{ framework: string; imports: string[] }> {
    return Object.entries(this.config.frameworks).map(([name, p]) => ({
      framework: name,
      imports: p.imports,
    }));
  }
}
