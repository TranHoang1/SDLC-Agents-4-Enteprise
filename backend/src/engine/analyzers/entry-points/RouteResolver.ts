/**
 * KSA-162: Route Resolver — Resolves full routes from controller prefix + method path.
 */

export class RouteResolver {
  /** Resolve full route: controller prefix + method path. */
  resolve(controllerPrefix: string | null, methodPath: string): string {
    const prefix = this.normalizePath(controllerPrefix ?? '');
    const path = this.normalizePath(methodPath);

    if (!prefix) return path || '/';
    if (!path || path === '/') return prefix;
    return `${prefix}${path}`;
  }

  /** Normalize route params: :id, {id}, <int:id> → {id}. */
  normalizeParams(path: string): string {
    return path
      // Express-style :param → {param}
      .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
      // Flask-style <type:param> → {param}
      .replace(/<(?:[a-z]+:)?([a-zA-Z_][a-zA-Z0-9_]*)>/g, '{$1}')
      // Already normalized {param} stays as-is
      ;
  }

  /** Extract route path from a decorator/annotation argument string. */
  extractPathFromArg(arg: string): string {
    // Remove quotes
    let path = arg.replace(/^['"`]|['"`]$/g, '').trim();
    // Normalize params
    path = this.normalizeParams(path);
    return path;
  }

  private normalizePath(path: string): string {
    if (!path) return '';
    // Ensure starts with /
    if (!path.startsWith('/')) path = '/' + path;
    // Remove trailing slash (except root)
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path;
  }
}
