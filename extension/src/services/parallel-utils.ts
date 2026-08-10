/**
 * parallel-utils.ts — Concurrency-limited parallel execution utilities.
 * Used by IndexingService to parallelize Pega rule fetches without
 * overwhelming the shared Pega server instance.
 */

/**
 * Result wrapper for parallel batch operations.
 * Captures both successful and failed items for downstream processing.
 */
export interface BatchResult<R> {
    results: R[];
    errors: Array<{ index: number; error: unknown }>;
}

/**
 * Execute async operations in parallel with a fixed batch size (concurrency limiter).
 * Items within each batch run concurrently via Promise.all; batches run sequentially.
 *
 * @param items - Array of items to process
 * @param batchSize - Max concurrent operations per batch (e.g., 5)
 * @param fn - Async function to apply to each item
 * @returns All resolved results in order, plus any errors encountered
 */
export async function parallelBatch<T, R>(
    items: T[],
    batchSize: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<BatchResult<R>> {
    const results: R[] = [];
    const errors: Array<{ index: number; error: unknown }> = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map((item, batchIdx) => {
            const globalIdx = i + batchIdx;
            return fn(item, globalIdx)
                .then((r) => { results.push(r); })
                .catch((err) => { errors.push({ index: globalIdx, error: err }); });
        });
        await Promise.all(batchPromises);
    }

    return { results, errors };
}
