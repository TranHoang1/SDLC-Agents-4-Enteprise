/**
 * SA4E-85 — LruCache.
 * Generic Least Recently Used cache with O(1) get/set operations.
 * Uses Map insertion order for LRU eviction.
 */

/**
 * LRU Cache implementation using Map's insertion-order property.
 * When capacity reached, the least recently accessed entry is evicted.
 * @template K - Key type
 * @template V - Value type
 */
export class LruCache<K, V> {
  private readonly map: Map<K, V> = new Map();
  private readonly capacity: number;

  /**
   * @param capacity - Maximum number of entries before eviction
   */
  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  /** Get value and promote to most-recently-used */
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;

    // Re-insert to move to end (most recent)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /** Set value, evicting oldest if at capacity */
  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      this.evictOldest();
    }
    this.map.set(key, value);
  }

  /** Check if key exists in cache */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /** Current number of cached entries */
  get size(): number {
    return this.map.size;
  }

  /** Remove all entries */
  clear(): void {
    this.map.clear();
  }

  /** Evict the least recently used entry (first in Map) */
  private evictOldest(): void {
    const firstKey = this.map.keys().next().value;
    if (firstKey !== undefined) {
      this.map.delete(firstKey);
    }
  }
}
