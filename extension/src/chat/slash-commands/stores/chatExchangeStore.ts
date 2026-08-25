/**
 * SA4E-191 — Real in-process exchange store (used by /undo).
 * Tracks the last user+agent message pair per session so /undo can remove it
 * and optionally revert associated file changes. No Svelte dependency.
 */
export interface ExchangePair {
  exchangeId: string;
  userMessageId: string;
  agentMessageId: string;
}

export class ChatExchangeStore {
  private exchanges: ExchangePair[] = [];

  addExchange(pair: ExchangePair): void {
    this.exchanges.push(pair);
  }

  findLastExchange(): ExchangePair | null {
    return this.exchanges.length ? this.exchanges[this.exchanges.length - 1] : null;
  }

  removeLastExchange(): ExchangePair | null {
    return this.exchanges.pop() ?? null;
  }

  clear(): void {
    this.exchanges = [];
  }

  get size(): number {
    return this.exchanges.length;
  }
}
