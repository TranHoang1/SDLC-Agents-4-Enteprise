/**
 * KSA-168: Similarity & Mining — Type definitions.
 * Duplicate detection, dead code analysis, and git history mining.
 */

export interface SimilarityPair {
  symbolIdA: number;
  symbolIdB: number;
  nameA: string;
  nameB: string;
  filePathA: string;
  filePathB: string;
  similarity: number;
}

export interface DuplicateCluster {
  id: string;
  members: ClusterMember[];
  avgSimilarity: number;
  suggestion: string;
}

export interface ClusterMember {
  symbolId: number;
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
}

export interface DuplicateReport {
  clusters: DuplicateCluster[];
  totalPairsScanned: number;
  totalDuplicates: number;
  scanDurationMs: number;
}

export interface DeadCodeCandidate {
  symbolId: number;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  confidence: number;
  reasons: string[];
}

export interface DeadCodeReport {
  candidates: DeadCodeCandidate[];
  totalFunctions: number;
  reachableCount: number;
  unreachableCount: number;
  scanDurationMs: number;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

export interface GitCommitResult extends GitCommit {
  score: number;
}

export interface GitIndexSummary {
  totalCommits: number;
  indexed: number;
  lastHash: string | null;
  lastIndexedAt: string | null;
}
