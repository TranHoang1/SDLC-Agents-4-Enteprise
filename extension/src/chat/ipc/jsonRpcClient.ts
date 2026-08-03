/**
 * SA4E-85 — JSON-RPC 2.0 Client (Task 7.3).
 * Handles request/response matching with unique IDs.
 * Manages pending requests with timeout cleanup.
 */

/** JSON-RPC 2.0 request structure */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown;
}

/** JSON-RPC 2.0 success response */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: JsonRpcError;
}

/** JSON-RPC 2.0 error object */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Pending request with resolve/reject callbacks */
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Default timeout for RPC calls (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * JsonRpcClient — serializes requests and matches responses by ID.
 * Stateless with respect to transport; callers provide send/receive hooks.
 */
export class JsonRpcClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Create a JSON-RPC request and register a pending response handler.
   * @returns The serialized request string and a promise for the result.
   */
  createRequest(method: string, params: unknown): { message: string; promise: Promise<unknown> } {
    const id = this.nextId++;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const message = JSON.stringify(request);

    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC timeout: ${method} (id=${id})`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
    });

    return { message, promise };
  }

  /**
   * Handle an incoming message — match to pending request by ID.
   * @returns true if the message was a matched response, false otherwise.
   */
  handleResponse(raw: string): boolean {
    try {
      const response = JSON.parse(raw) as JsonRpcResponse;
      if (response.jsonrpc !== '2.0' || response.id == null) return false;

      const pending = this.pending.get(response.id);
      if (!pending) return false;

      clearTimeout(pending.timer);
      this.pending.delete(response.id);

      if (response.error) {
        const err = new Error(response.error.message);
        (err as Error & { code: number }).code = response.error.code;
        pending.reject(err);
      } else {
        pending.resolve(response.result);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Reject all pending requests (e.g., on disconnect) */
  rejectAll(reason: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  /** Number of currently pending requests */
  get pendingCount(): number {
    return this.pending.size;
  }
}
