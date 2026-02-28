class InMemoryIdempotencyStore {
  constructor(ttlHours) {
    this.ttlMs = Math.max(1, ttlHours) * 60 * 60 * 1000;
    this.store = new Map();
  }

  async has(key) {
    this.cleanup();
    return this.store.has(key);
  }

  async set(key, requestId) {
    const now = Date.now();
    this.store.set(key, {
      requestId,
      expiresAt: now + this.ttlMs,
    });
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async close() {
    return undefined;
  }
}

module.exports = InMemoryIdempotencyStore;
