/**
 * SA4E-85 — Virtual Scroll Calculator (Task 2.3 helper).
 * Computes visible window indices for virtualized message list.
 * Supports ≤1000 messages at 60fps by rendering only visible + buffer items.
 */

/** Configuration for the virtual scroll viewport */
export interface VirtualScrollConfig {
  /** Total number of items in the list */
  totalItems: number;
  /** Estimated height of each item in pixels */
  itemHeight: number;
  /** Height of the visible viewport in pixels */
  viewportHeight: number;
  /** Current scroll offset from top in pixels */
  scrollTop: number;
  /** Number of buffer items above/below visible area (BR-18: 5) */
  bufferSize: number;
}

/** Result of the virtual scroll calculation */
export interface VirtualScrollRange {
  /** First item index to render (inclusive) */
  startIndex: number;
  /** Last item index to render (inclusive) */
  endIndex: number;
  /** Top offset in pixels for positioning (spacer above) */
  offsetTop: number;
  /** Total scrollable height in pixels */
  totalHeight: number;
}

/**
 * Calculate the visible range of items given scroll state.
 * Returns indices for items to render including buffer zone.
 */
export function computeVisibleRange(config: VirtualScrollConfig): VirtualScrollRange {
  const { totalItems, itemHeight, viewportHeight, scrollTop, bufferSize } = config;

  if (totalItems === 0) {
    return { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 };
  }

  const totalHeight = totalItems * itemHeight;

  // Calculate first visible item (before buffer)
  const rawStart = Math.floor(scrollTop / itemHeight);
  const startIndex = Math.max(0, rawStart - bufferSize);

  // Calculate last visible item (after buffer)
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const rawEnd = rawStart + visibleCount;
  const endIndex = Math.min(totalItems - 1, rawEnd + bufferSize);

  // Offset positions the rendered slice correctly in scroll space
  const offsetTop = startIndex * itemHeight;

  return { startIndex, endIndex, offsetTop, totalHeight };
}
