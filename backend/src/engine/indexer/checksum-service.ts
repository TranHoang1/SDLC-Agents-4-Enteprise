/**
 * SA4E-101 — ChecksumService: SHA-256 computation and comparison for the
 * checksum-based skip optimization (UC-07). Delegates persistence to
 * FileChecksumRepository. All failures degrade gracefully (fall back to full
 * processing) per EF-04.
 */

import { createHash } from 'crypto';
import type { FileChecksumRepository } from '../../database/repositories/FileChecksumRepository.js';
import pino from 'pino';

const logger = pino({ name: 'checksum-service' });

export class ChecksumService {
  constructor(private readonly repo: FileChecksumRepository) {}

  /** Compute SHA-256 hex digest of file content. */
  computeChecksum(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /** Pre-load all checksums for a tenant into memory (batch, single query). */
  async preloadChecksums(userId: string, projectId: string): Promise<Map<string, string>> {
    try {
      return await this.repo.loadAll(userId, projectId);
    } catch (err) {
      logger.warn({ err, userId, projectId }, '[checksum] preload failed, falling back to full processing');
      return new Map();
    }
  }

  /** Compare computed vs stored; skip when unchanged. */
  shouldSkip(filePath: string, computed: string, stored: Map<string, string>): boolean {
    const prev = stored.get(filePath);
    return prev !== undefined && prev === computed;
  }

  /** Persist a computed checksum (fire-and-forget safe). */
  async upsert(userId: string, projectId: string, filePath: string, checksum: string): Promise<void> {
    try {
      await this.repo.upsert({ user_id: userId, project_id: projectId, file_path: filePath, file_checksum: checksum });
    } catch (err) {
      logger.warn({ err, filePath }, '[checksum] upsert failed (non-fatal)');
    }
  }

  /** Cleanup checksums for deleted/missing files (AF-13). */
  async cleanupDeleted(userId: string, projectId: string, currentFiles: string[]): Promise<number> {
    try {
      return await this.repo.deleteNotIn(userId, projectId, currentFiles);
    } catch (err) {
      logger.warn({ err }, '[checksum] cleanup deleted failed (non-fatal)');
      return 0;
    }
  }
}
