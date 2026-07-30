import { Worker } from 'worker_threads';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

interface PoolWorker {
  worker: Worker;
  busy: boolean;
  id: number;
}

interface Task<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  timeout: number;
  timer: NodeJS.Timeout | null;
}

export interface PoolStats {
  total: number;
  busy: number;
  idle: number;
  pendingTasks: number;
}

export class PegaWorkerPool {
  private workers: PoolWorker[] = [];
  private taskQueue: Array<{ data: unknown; task: Task<unknown> }> = [];
  private nextId = 0;

  constructor(size: number = 2) {
    for (let i = 0; i < size; i++) {
      this.addWorker();
    }
  }

  private addWorker(): void {
    const id = this.nextId++;
    const workerPath = path.join(__dirname, '..', 'security', 'worker-evaluator.js');
    try {
      const worker = new Worker(workerPath);
      const pw: PoolWorker = { worker, busy: false, id };

      worker.on('message', (msg) => {
        pw.busy = false;
        this.processQueue();
      });

      worker.on('error', (err) => {
        pw.busy = false;
        this.processQueue();
      });

      worker.on('exit', () => {
        pw.busy = false;
      });

      this.workers.push(pw);
    } catch {
      // Worker pool best-effort
    }
  }

  dispatch<T>(data: unknown, timeout: number = 5000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: Task<T> = {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
        timer: null,
      };

      this.taskQueue.push({ data, task: task as Task<unknown> });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    const worker = this.workers.find(w => !w.busy);
    if (!worker) return;

    const item = this.taskQueue.shift();
    if (!item) return;

    worker.busy = true;
    worker.worker.postMessage(item.data);
  }

  getStats(): PoolStats {
    return {
      total: this.workers.length,
      busy: this.workers.filter(w => w.busy).length,
      idle: this.workers.filter(w => !w.busy).length,
      pendingTasks: this.taskQueue.length,
    };
  }

  async terminate(): Promise<void> {
    for (const pw of this.workers) {
      await pw.worker.terminate();
    }
    this.workers = [];
    this.taskQueue = [];
  }
}
