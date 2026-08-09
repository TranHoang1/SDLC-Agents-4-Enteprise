/**
 * SA4E-95 - SchemaCacheManager: file-based cache manifest for incremental generation.
 * Implements UC-09, BR-14: version-based invalidation using pzUpdateDateTime.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { CacheManifest, CacheEntry } from '../models/CacheManifest.js';

/**
 * Manages the schema cache manifest for incremental regeneration.
 * Cache-Aside pattern: check before generating, update after.
 */
export class SchemaCacheManager {
  private readonly manifestPath: string;
  private manifest: CacheManifest | null = null;

  constructor(private readonly schemasDir: string) {
    this.manifestPath = path.join(schemasDir, '.cache-manifest.json');
  }

  /** Load cache manifest from disk */
  loadManifest(): CacheManifest {
    if (this.manifest) return this.manifest;

    if (!fs.existsSync(this.manifestPath)) {
      this.manifest = this.createEmptyManifest();
      return this.manifest;
    }

    try {
      const raw = fs.readFileSync(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(raw) as CacheManifest;
      return this.manifest;
    } catch {
      // Corrupted cache — start fresh
      this.manifest = this.createEmptyManifest();
      return this.manifest;
    }
  }

  /** Check if a schema is stale based on pzUpdateDateTime (BR-14) */
  isStale(ruleType: string, updateDateTime: string): boolean {
    const manifest = this.loadManifest();
    const entry = manifest.entries.find((e) => e.ruleType === ruleType);
    if (!entry) return true;
    return entry.updateDateTime !== updateDateTime;
  }

  /** Get cached entry for a rule type */
  getEntry(ruleType: string): CacheEntry | undefined {
    const manifest = this.loadManifest();
    return manifest.entries.find((e) => e.ruleType === ruleType);
  }

  /** Update cache after successful schema generation */
  updateEntry(entry: CacheEntry): void {
    const manifest = this.loadManifest();
    const idx = manifest.entries.findIndex((e) => e.ruleType === entry.ruleType);

    if (idx >= 0) {
      manifest.entries[idx] = entry;
    } else {
      manifest.entries.push(entry);
    }

    manifest.generatedAt = new Date().toISOString();
    this.saveManifest(manifest);
  }

  /** Compute SHA-256 hash of schema content for change detection */
  computeSchemaHash(schemaContent: string): string {
    return `sha256:${crypto.createHash('sha256').update(schemaContent).digest('hex')}`;
  }

  /** Persist manifest to disk */
  private saveManifest(manifest: CacheManifest): void {
    // Ensure directory exists
    if (!fs.existsSync(this.schemasDir)) {
      fs.mkdirSync(this.schemasDir, { recursive: true });
    }

    const content = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(this.manifestPath, content, 'utf-8');
    this.manifest = manifest;
  }

  /** Create empty manifest for first run */
  private createEmptyManifest(): CacheManifest {
    return { version: '1.0', generatedAt: '', entries: [] };
  }
}
