import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  matchExcludePattern,
  prepareSafeMount,
  shouldExclude,
} from '../../../src/modules/sandbox/executors/mountSecurity.js';

describe('mountSecurity', () => {
  it('matchExcludePattern handles exact, glob and directory patterns (BR-08)', () => {
    expect(matchExcludePattern('.env', '.env')).toBe(true);
    expect(matchExcludePattern('a.pem', '*.pem')).toBe(true);
    expect(matchExcludePattern('.env.local', '.env.*')).toBe(true);
    expect(matchExcludePattern('.ssh/id_rsa', '.ssh/')).toBe(true);
    expect(matchExcludePattern('.ssh/x', '.ssh/')).toBe(true);
    expect(matchExcludePattern('src/main.ts', '*.pem')).toBe(false);
    expect(matchExcludePattern('config.json', '.docker/config.json')).toBe(false);
    expect(matchExcludePattern('.docker/config.json', '.docker/config.json')).toBe(true);
  });

  it('shouldExclude evaluates against a pattern list', () => {
    const patterns = ['.env', '*.pem', '.ssh/'];
    expect(shouldExclude('.env', patterns)).toBe(true);
    expect(shouldExclude('key.pem', patterns)).toBe(true);
    expect(shouldExclude('app.ts', patterns)).toBe(false);
  });

  it('prepareSafeMount excludes sensitive files from the copy (TC-15)', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-src-'));
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-out-'));
    fs.writeFileSync(path.join(src, '.env'), 'SECRET=1');
    fs.writeFileSync(path.join(src, 'app.ts'), 'console.log(1)');
    fs.mkdirSync(path.join(src, '.ssh'));
    fs.writeFileSync(path.join(src, '.ssh', 'id_rsa'), 'key');
    prepareSafeMount(src, ['.env', '.ssh/', '*.pem'], dst);
    expect(fs.existsSync(path.join(dst, '.env'))).toBe(false);
    expect(fs.existsSync(path.join(dst, '.ssh'))).toBe(false);
    expect(fs.existsSync(path.join(dst, 'app.ts'))).toBe(true);
  });
});
