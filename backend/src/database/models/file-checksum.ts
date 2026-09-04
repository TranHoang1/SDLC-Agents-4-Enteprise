/**
 * SA4E-101 — File checksum persistence record (DB cold-path).
 * Supports checksum-based skip (UC-07) with one checksum per file per tenant.
 */

export interface FileChecksumRecord {
  id: string; // UUID
  user_id: string;
  project_id: string;
  file_path: string;
  file_checksum: string; // SHA-256 hex (64 chars)
  last_indexed_at: Date;
}
