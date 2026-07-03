/**
 * NativeAddonResolver — Resolves better-sqlite3 native binding for standalone MCP server.
 *
 * Modes:
 * 1. Extension mode: BETTER_SQLITE3_BINDING env var set → use that path directly
 * 2. Standalone mode: auto-detect platform, check cache, download if needed
 * 3. Fallback: if download fails → try require("better-sqlite3") (npm-installed)
 *
 * Cache: ~/.code-intel/native-addons/better-sqlite3/v{version}/node-v{major}-{platform}-{arch}/better_sqlite3.node
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';

// ─── Manifest (embedded from release-manifest.json) ──────────────────────────

interface BinaryEntry {
  url: string;
  sha256: string;
  size: number;
}

interface NativeManifest {
  version: string;
  releaseUrl: string;
  binaries: Record<string, BinaryEntry>;
}

const MANIFEST: NativeManifest = {
  version: '12.10.0',
  releaseUrl: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/tag/better-sqlite3-v12.10.0',
  binaries: {
    'node-v20-win32-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v20-win32-x64.node',
      sha256: 'b165e37c93f9a5e2b246ab3feb29ccfc66c221c8368ca744a820be57b0b81055',
      size: 1912832,
    },
    'node-v20-darwin-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v20-darwin-x64.node',
      sha256: '4b62eb165db8d64f67675e68a0ce2ac7fd0faa4da0399fc5bc033cf341adcbca',
      size: 1931184,
    },
    'node-v20-darwin-arm64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v20-darwin-arm64.node',
      sha256: '7748c91a71319897b00b0e1386246980dd06a0d083d906ef633926a4b0e7c4f7',
      size: 1914640,
    },
    'node-v20-linux-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v20-linux-x64.node',
      sha256: '308dc665be61af8faf8a272188ab1ac26710cf3e681fbefc32791ccf2b17ebc0',
      size: 2212536,
    },
    'node-v22-win32-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v22-win32-x64.node',
      sha256: 'b936c55e4d59433fce3e84b6e98ccdc8af0e7eb9243d0c12f1570045da972b9f',
      size: 1918464,
    },
    'node-v22-darwin-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v22-darwin-x64.node',
      sha256: 'd74ae4ac4261c1266fed01da1e8474e001253493db3ce062cfac03720385999d',
      size: 1931472,
    },
    'node-v22-darwin-arm64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v22-darwin-arm64.node',
      sha256: 'd74ae4ac4261c1266fed01da1e8474e001253493db3ce062cfac03720385999d',
      size: 1931472,
    },
    'node-v22-linux-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v22-linux-x64.node',
      sha256: '1ba30ab367585433049007c732f0d83423584697636474ab99b9c64911650bd3',
      size: 2118112,
    },
    'node-v24-win32-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v24-win32-x64.node',
      sha256: 'c045b58a00aeb5939d77d1901df4be384dff49ec452de93fdb02efe8d25fa9f5',
      size: 1918464,
    },
    'node-v24-darwin-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v24-darwin-x64.node',
      sha256: 'cefecba1ccc5912528e86d15bbc1f9080ce2e81f10cd8ba2dd89296ee1e7444a',
      size: 1931856,
    },
    'node-v24-darwin-arm64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v24-darwin-arm64.node',
      sha256: 'cefecba1ccc5912528e86d15bbc1f9080ce2e81f10cd8ba2dd89296ee1e7444a',
      size: 1931856,
    },
    'node-v24-linux-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v24-linux-x64.node',
      sha256: '4a6fdb191fdd1f9c0522e6932accc940f4e2a2f15a3b8c9008e57ad88d24872a',
      size: 2122416,
    },
    'node-v25-win32-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v25-win32-x64.node',
      sha256: '58cb9c693c6174fe96d55c3fe9e0802dcdd9301fa9b07bb5e8fdc35eab44090c',
      size: 1920000,
    },
    'node-v25-darwin-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v25-darwin-x64.node',
      sha256: 'fce741de632e5242334cfdcc6d818414fdb28273b4cbf67b9ac3f38178eff281',
      size: 1932624,
    },
    'node-v25-darwin-arm64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v25-darwin-arm64.node',
      sha256: 'fce741de632e5242334cfdcc6d818414fdb28273b4cbf67b9ac3f38178eff281',
      size: 1932624,
    },
    'node-v25-linux-x64': {
      url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v12.10.0/better-sqlite3-v12.10.0-node-v25-linux-x64.node',
      sha256: 'c632c95ef5ce07b8f2734da09bc7e549a7aa005c1df1710f61202618374c5545',
      size: 2162440,
    },
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve the native binding path. Must be called (and awaited) before creating Database instances.
 * Returns the path to better_sqlite3.node, or undefined if fallback to npm-installed should be used.
 *
 * KSA-112: If cached binary has wrong NODE_MODULE_VERSION, auto-delete and re-download.
 */
export async function resolveNativeBinding(): Promise<string | undefined> {
  // Mode 1: Extension provides binding via env var
  const envBinding = process.env.BETTER_SQLITE3_BINDING;
  if (envBinding) {
    console.error(`[native-addon] Extension mode: using ${envBinding}`);
    // KSA-112: Validate the binding is loadable before returning
    if (await validateBinding(envBinding)) {
      return envBinding;
    }
    console.error(`[native-addon] ⚠️ Extension-provided binding failed to load (MODULE_VERSION mismatch?)`);
    console.error(`[native-addon] Falling back to self-resolve for runtime Node v${getNodeMajorVersion()}`);
    // Fall through to Mode 2 — self-resolve for the actual runtime
  }

  // Mode 2: Standalone — auto-resolve
  console.error('[native-addon] Standalone mode: resolving prebuilt binary...');

  const cacheKey = getCacheKey();
  if (!cacheKey) {
    console.error('[native-addon] Unsupported platform, falling back to npm-installed');
    return undefined;
  }

  const cachePath = getCachePath(cacheKey);
  const bindingFile = path.join(cachePath, 'better_sqlite3.node');

  // Check cache
  if (fs.existsSync(bindingFile) && fs.statSync(bindingFile).size > 0) {
    // KSA-112: Validate cached binary is loadable
    if (await validateBinding(bindingFile)) {
      console.error(`[native-addon] Cache hit (validated): ${bindingFile}`);
      return bindingFile;
    }
    // Cached binary has wrong MODULE_VERSION — delete and re-download
    console.error(`[native-addon] ⚠️ Cached binary MODULE_VERSION mismatch. Deleting: ${bindingFile}`);
    try { fs.unlinkSync(bindingFile); } catch { /* ignore */ }
  }

  // Download
  try {
    await downloadBinary(cacheKey, cachePath, bindingFile);
    console.error(`[native-addon] Downloaded and verified: ${bindingFile}`);
    return bindingFile;
  } catch (err: any) {
    console.error(`[native-addon] Download failed: ${err.message}`);
    console.error('[native-addon] Falling back to npm-installed better-sqlite3');
    return undefined;
  }
}

/**
 * Synchronous resolve — returns cached path or undefined.
 * Use after resolveNativeBinding() has been called at startup.
 */
export function resolveNativeBindingSync(): string | undefined {
  const envBinding = process.env.BETTER_SQLITE3_BINDING;
  if (envBinding) return envBinding;

  const cacheKey = getCacheKey();
  if (!cacheKey) return undefined;

  const bindingFile = path.join(getCachePath(cacheKey), 'better_sqlite3.node');
  if (fs.existsSync(bindingFile) && fs.statSync(bindingFile).size > 0) {
    return bindingFile;
  }
  return undefined;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * KSA-112: Validate that a .node binding file can be loaded by the current runtime.
 * Uses process.dlopen() test to catch MODULE_VERSION mismatch before actual use.
 * Returns true if loadable, false if mismatch or other error.
 */
async function validateBinding(bindingPath: string): Promise<boolean> {
  try {
    // Quick check: file exists and has content
    if (!fs.existsSync(bindingPath) || fs.statSync(bindingPath).size === 0) {
      return false;
    }

    // Try to load the native module — this will throw ERR_DLOPEN_FAILED if MODULE_VERSION mismatches
    const testModule = { exports: {} } as any;
    process.dlopen(testModule, bindingPath);

    // If we get here, the binding loaded successfully
    console.error(`[native-addon] ✅ Binding validated: ${bindingPath}`);
    return true;
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('ERR_DLOPEN_FAILED') || msg.includes('NODE_MODULE_VERSION') || msg.includes('was compiled against')) {
      console.error(`[native-addon] ❌ MODULE_VERSION mismatch: ${msg.substring(0, 200)}`);
    } else {
      console.error(`[native-addon] ❌ Binding validation failed: ${msg.substring(0, 200)}`);
    }
    return false;
  }
}

function getNodeMajorVersion(): string {
  return process.versions.node.split('.')[0];
}

function getCacheKey(): string | null {
  const platform = process.platform;
  const arch = process.arch;
  const major = getNodeMajorVersion();

  // Strategy 1: exact match
  const exactKey = `node-v${major}-${platform}-${arch}`;
  if (exactKey in MANIFEST.binaries) return exactKey;

  // Strategy 2: closest lower Node major for same platform/arch
  const runtimeMajor = parseInt(major, 10);
  const candidates = Object.keys(MANIFEST.binaries)
    .filter(k => k.startsWith('node-v') && k.endsWith(`-${platform}-${arch}`))
    .map(k => ({ key: k, major: parseInt(k.match(/node-v(\d+)/)?.[1] || '0', 10) }))
    .filter(c => c.major <= runtimeMajor)
    .sort((a, b) => b.major - a.major);

  if (candidates.length > 0) {
    console.error(`[native-addon] Node v${major}, using compatible binary: ${candidates[0].key}`);
    return candidates[0].key;
  }

  return null;
}

function getCachePath(cacheKey: string): string {
  const homeDir = os.homedir();
  return path.join(
    homeDir,
    '.code-intel',
    'native-addons',
    'better-sqlite3',
    `v${MANIFEST.version}`,
    cacheKey
  );
}

async function downloadBinary(cacheKey: string, cachePath: string, bindingFile: string): Promise<void> {
  const entry = MANIFEST.binaries[cacheKey];
  if (!entry) {
    throw new Error(`No binary available for ${cacheKey}`);
  }

  // Ensure cache directory
  fs.mkdirSync(cachePath, { recursive: true });

  console.error(`[native-addon] Downloading: ${entry.url}`);
  console.error(`[native-addon] Expected size: ${(entry.size / 1024 / 1024).toFixed(1)} MB`);

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.error(`[native-addon] Retry ${attempt}/${maxAttempts}...`);
        await sleep(2000 * (attempt - 1));
      }

      await downloadFile(entry.url, bindingFile);

      // Verify SHA256
      const hash = computeSha256Sync(bindingFile);
      if (hash !== entry.sha256) {
        cleanupFile(bindingFile);
        throw new Error(
          `Checksum mismatch: expected ${entry.sha256.substring(0, 16)}..., got ${hash.substring(0, 16)}...`
        );
      }

      return; // success
    } catch (err: any) {
      cleanupFile(bindingFile);
      if (attempt === maxAttempts) throw err;
    }
  }
}

function downloadFile(url: string, target: string, maxRedirects = 10): Promise<void> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      timeout: 60000,
      headers: {
        'User-Agent': 'mcp-code-intelligence/1.0',
      },
    };

    const req = client.get(options, (res) => {
      const status = res.statusCode ?? 0;

      // Handle redirects (GitHub returns 302 to CDN)
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, target, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (status !== 200) {
        res.resume();
        reject(new Error(`HTTP ${status} from ${parsedUrl.hostname}`));
        return;
      }

      const file = fs.createWriteStream(target);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        cleanupFile(target);
        reject(err);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timed out (60s)'));
    });

    req.on('error', (err) => {
      cleanupFile(target);
      reject(err);
    });
  });
}

function computeSha256Sync(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
