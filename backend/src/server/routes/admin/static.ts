import { Hono } from 'hono';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { AdminContext } from './context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createStaticRoutes(_ctx: AdminContext): Hono {
  const app = new Hono();
  const spaPath = path.resolve(__dirname, '../../../viewer/admin/index.html');

  app.get('/admin', (c) => {
    if (fs.existsSync(spaPath)) {
      let html = fs.readFileSync(spaPath, 'utf-8');
      const token = c.req.query('token');
      const page = c.req.query('page') || '';
      const embed = c.req.query('embed');
      if (embed) {
        html = html.replace('</head>', '<style>.sidebar{display:none!important}.main{padding:0!important;height:100vh!important;width:100%!important}</style></head>');
        html = html.replace('<body>', '<body data-embed="true">');
      }
      if (token) {
        // SEC: sanitize token — only allow alphanumeric, dash, dot, underscore to prevent XSS
        const safeToken = token.replace(/[^A-Za-z0-9\-_.]/g, '');
        if (safeToken.length > 0) {
          const injectScript = '<script>localStorage.setItem("admin_token","' + safeToken + '");</script>';
          html = html.replace('</head>', injectScript + '</head>');
        }
      }
      if (page) {
        // SEC SR-07: sanitize page param — prevents reflected XSS via crafted URL
        const safePage = page.replace(/[^A-Za-z0-9\-_]/g, '');
        if (safePage) {
          html = html.replace("useState('dashboard')", "useState('" + safePage + "')");
        }
      }
      return new Response(html, { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } });
    }
    return c.text('Admin Portal not found', 404);
  });

  const viewerAdminDir = path.resolve(__dirname, '../../../viewer/admin');

  // Serve any static asset under /admin/ (JS, CSS, vendor libs, etc.) with correct MIME type.
  // Query strings (?embed=&page=&token=) are ignored — only the path matters for file lookup.
  // Path traversal is prevented by resolving + verifying the result stays within viewerAdminDir.
  app.get('/admin/*', (c) => {
    const urlPath = c.req.path; // e.g. /admin/vendor/react.production.min.js
    const relative = urlPath.replace(/^\/admin\//, '');

    // Attempt to serve as a static asset if it has a known asset extension
    const ext = path.extname(relative).toLowerCase();
    if (ext && MIME_TYPES[ext]) {
      const resolved = path.resolve(viewerAdminDir, relative);
      // SEC: prevent path traversal — resolved path must stay within viewerAdminDir
      if (resolved.startsWith(viewerAdminDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return new Response(fs.readFileSync(resolved), {
          headers: { 'Content-Type': MIME_TYPES[ext], 'Cache-Control': 'no-cache' },
        });
      }
      // Asset not found → 404 (do NOT fall back to HTML for asset requests)
      return c.text('Not found', 404);
    }

    // Non-asset path (SPA client route) → serve index.html for client-side routing
    if (fs.existsSync(spaPath)) {
      const html = fs.readFileSync(spaPath, 'utf-8');
      return c.html(html);
    }
    return c.text('Admin Portal not found', 404);
  });

  return app;
}

/** MIME types for static viewer assets. Extensions not listed fall through to SPA HTML. */
const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};
