const { createClient } = require("redis");

class RedisIdempotencyStore {
  constructor(redisUrl, ttlHours) {
    this.ttlSeconds = Math.max(1, ttlHours) * 60 * 60;
    this.client = createClient({ url: redisUrl });
    this.connectPromise = this.client.connect();
  }

  keyName(key) {
    return `idem:${key}`;
  }

  async ensureConnected() {
    await this.connectPromise;
  }

  async has(key) {
    await this.ensureConnected();
    const value = await this.client.get(this.keyName(key));
    return Boolean(value);
  }

  async set(key, requestId) {
    await this.ensureConnected();
    await this.client.set(this.keyName(key), requestId, {
      EX: this.ttlSeconds,
    });
  }

  async close() {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

module.exports = RedisIdempotencyStore;
