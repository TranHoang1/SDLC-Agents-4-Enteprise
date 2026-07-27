# TASK — Work Package 7: Deployment & Performance

## 1. Summary

Infrastructure for running compute-intensive Pega evaluation in production alongside the existing indexing service. Design uses a `worker_threads` pool to isolate CPU-bound evaluation from the main Hono HTTP server, with configurable pool size, per-evaluation timeout, and an LRU result cache.

Reference: [Upgrade Plan §9](../SA4E-56/pega-parser-upgrade-plan.md#9-work-package-7-deployment--performance-considerations)

## 2. Worker Thread Pool Design

```
PegaWorkerPool
  ├─ Pool size: max(1, os.cpus().length - 1)
  ├─ Task dispatch: round-robin across available workers
  ├─ Timeout: 5s per task (configurable)
  ├─ On timeout: worker.terminate() → create replacement worker
  └─ Queue: FIFO for pending tasks when all workers busy

Worker Thread (per task):
  ├─ Deserialize task: ExpressionAST + ClipboardContext
  ├─ Execute: evaluator.walk(ast, context)
  ├─ Serialize result
  └─ Post result back to main thread
```

## 3. LRU Cache

| Property | Value |
|----------|-------|
| Max entries | 1000 (configurable via `cacheSize`) |
| Eviction policy | Least Recently Used |
| Cache key | `hash(expressionText + clipboardKey)` |
| Use case | Repeated When evaluation with same context |
| Invalidation | Cleared when clipboard context changes |

## 4. Performance Benchmarks

| ID | Scenario | Metric | Target |
|----|----------|--------|--------|
| PB-01 | 100 simple property lookups in series | Total time | < 50ms |
| PB-02 | 100 expression evaluations (mixed complexity) in series | Total time | < 500ms |
| PB-03 | 10 concurrent expression evaluations (worker pool) | Total time | < 2s |
| PB-04 | Decision table with 500 rows, 5 conditions | Single eval time | < 500ms |
| PB-05 | Decision tree with depth 20 | Single eval time | < 100ms |
| PB-06 | Workflow simulation with 50 shapes | Simulation time | < 500ms |
| PB-07 | UI section render with 100 fields | Render time | < 200ms |
| PB-08 | Memory usage after 1000 evaluations | Heap increase | < 50MB |

## 5. Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `poolSize` | `max(1, cpus-1)` | Worker thread pool size |
| `evalTimeout` | 5000ms | Per-evaluation timeout in ms |
| `maxDecisionRows` | 10000 | Hard limit on decision table rows evaluated |
| `cacheSize` | 1000 | LRU cache max entries |
| `deployMode` | `in-process` | `in-process` (AbortController) or `worker-pool` |
| `maxEvalDepth` | 100 | Maximum expression AST depth |

## 6. Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **PegaWorkerPool** | `backend/src/modules/pega/deploy/PegaWorkerPool.ts` | Manage worker_thread pool: create, dispatch, timeout, recycle |
| **PegaWorkerTask** | `backend/src/modules/pega/deploy/PegaWorkerTask.ts` | Serialized task definition for worker IPC |
| **PegaEvaluationCache** | `backend/src/modules/pega/deploy/PegaEvaluationCache.ts` | LRU cache for evaluation results |
| **PegaConfigProvider** | `backend/src/modules/pega/deploy/PegaConfigProvider.ts` | Read deployment mode, pool size, timeout from config |

## 7. Effort: 3 person-weeks

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Worker pool implementation | 1 | Node.js worker_threads |
| Evaluation timeout + abort mechanism | 0.5 | Worker pool |
| Evaluation result cache (LRU) | 0.5 | Config model |
| Performance benchmarking (PB-01 to PB-08) | 0.5 | All evaluators complete |
| Config mode (in-process vs worker-pool) | 0.5 | Worker pool |

## 8. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| WP1 — Expression evaluator | Strong | Must be serializable for worker IPC |
| WP3 — Decision evaluator | Strong | Must be serializable for worker IPC |
| WP2 — Workflow engine | Moderate | Larger task; may be in-process only |
| WP5 — Security sandbox | Overlap | Sandbox timeout can reuse worker thread timeout |

## 9. Out of Scope
- Horizontal scaling / load balancing
- Kubernetes / container orchestration
- Database connection pooling
- Monitoring/alerting infrastructure