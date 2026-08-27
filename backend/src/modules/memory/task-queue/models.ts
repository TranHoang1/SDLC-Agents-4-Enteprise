/**
 * Task Queue Models — SA4E-44
 * Enums and interfaces for the persistent task queue.
 */

export enum TaskType {
  TAG_ENRICHMENT = 'TAG_ENRICHMENT',
  VECTOR_EMBEDDING = 'VECTOR_EMBEDDING',
  /** SA4E-99: LLM summary + pseudo code for code symbols (functions, classes). */
  CODE_ENRICHMENT = 'CODE_ENRICHMENT',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * SA4E-155: Priority levels for the task queue.
 * Higher number = claimed first (claimNext/claimBatch ORDER BY priority DESC, created_at ASC).
 * Normal background enrichment tasks use PRIORITY_NORMAL (0); on-demand user requests
 * use PRIORITY_HIGH (100) so they jump ahead of bulk backlog.
 */
export enum TaskPriority {
  NORMAL = 0,
  HIGH = 100,
}

export interface PendingTask {
  id: number;
  task_type: TaskType;
  entry_id: number;
  status: TaskStatus;
  payload: string;
  error: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateTaskInput {
  task_type: TaskType;
  entry_id: number;
  payload: object;
  max_retries?: number;
  project_id?: string | null;
  /** SA4E-155: queue priority. Higher claimed first. Defaults to PRIORITY_NORMAL (0). */
  priority?: number;
}
