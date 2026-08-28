/**
 * Unit tests — DiskBackedSet: exact membership across RAM hot tier + disk spill.
 * Verifies overflow-to-disk correctness, exact has() on spilled keys, dispose cleanup.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DiskBackedSet } from '../DiskBackedSet';

function tmpFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dbs-')), 'dedup.bin');
}

describe('DiskBackedSet', () => {
  const sets: DiskBackedSet[] = [];
  const track = (s: DiskBackedSet) => { sets.push(s); return s; };

  afterEach(() => {
    for (const s of sets.splice(0)) s.dispose();
  });

  it('add returns true for new keys and false for duplicates', () => {
    const s = track(new DiskBackedSet(tmpFile(), 100));
    expect(s.add('a')).toBe(true);
    expect(s.add('a')).toBe(false);
    expect(s.has('a')).toBe(true);
    expect(s.has('b')).toBe(false);
  });

  it('keeps exact membership after keys overflow to disk (cap=2)', () => {
    const s = track(new DiskBackedSet(tmpFile(), 2));
    // Add more than the hot-tier cap so earlier keys spill to disk.
    for (let i = 0; i < 50; i++) s.add(`Rule-Obj-Activity Work-HR key${i}`);
    // Every key — hot or spilled — must still be found.
    for (let i = 0; i < 50; i++) {
      expect(s.has(`Rule-Obj-Activity Work-HR key${i}`)).toBe(true);
    }
    expect(s.has('Rule-Obj-Activity Work-HR key999')).toBe(false);
    expect(s.size).toBe(50);
  });

  it('distinguishes same rule name across different types/classes', () => {
    const s = track(new DiskBackedSet(tmpFile(), 1)); // force spilling
    s.add('Rule-Obj-Activity ClassA Approve');
    s.add('Rule-HTML-Section ClassA Approve');
    s.add('Rule-Obj-Activity ClassB Approve');
    // All three are distinct despite sharing the rule name "Approve".
    expect(s.has('Rule-Obj-Activity ClassA Approve')).toBe(true);
    expect(s.has('Rule-HTML-Section ClassA Approve')).toBe(true);
    expect(s.has('Rule-Obj-Activity ClassB Approve')).toBe(true);
    // A fourth combination that was never added must not match.
    expect(s.has('Rule-HTML-Section ClassB Approve')).toBe(false);
    expect(s.size).toBe(3);
  });

  it('add is idempotent even for spilled keys', () => {
    const s = track(new DiskBackedSet(tmpFile(), 1));
    expect(s.add('x')).toBe(true);
    s.add('y'); // pushes 'x' to disk
    s.add('z');
    expect(s.add('x')).toBe(false); // 'x' now on disk, must still dedup
    expect(s.size).toBe(3);
  });

  it('dispose deletes the spill file and clears state', () => {
    const file = tmpFile();
    const s = new DiskBackedSet(file, 1);
    s.add('a'); s.add('b'); // triggers spill file creation
    expect(fs.existsSync(file)).toBe(true);
    s.dispose();
    expect(fs.existsSync(file)).toBe(false);
    expect(s.size).toBe(0);
    expect(s.has('a')).toBe(false);
  });
});
