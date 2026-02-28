const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp } = require("../src/app");
const InMemoryIdempotencyStore = require("../src/idempotencyStore");

function createTestSetup() {
  const config = {
    relayApiToken: "test-token",
    brevoEnabled: false,
    brevoApiKey: "",
    brevoEventsUrl: "https://api.brevo.com/v3/events",
    idempotencyTtlHours: 24,
    useRedisIdempotency: false,
    redisUrl: "redis://127.0.0.1:6379",
    dlqEnabled: true,
    dlqFilePath: "./dlq-events.log",
    defaultCurrency: "EUR",
  };

  const idempotencyStore = new InMemoryIdempotencyStore(24);
  const dlqEntries = [];
  const dlqWriter = {
    write: async (entry) => {
      dlqEntries.push(entry);
    },
  };
  const app = createApp({ config, idempotencyStore, dlqWriter });

  return { app, dlqEntries };
}

function validPayload() {
  return {
    event: "add_to_cart",
    shop: "mono-conversion.myshopify.com",
    template: "product",
    timestamp: "2026-02-27T10:15:10.123Z",
    funnel_step: "product",
    session_id: "sess_123",
    product_id: 111,
    product_title: "Produit test",
  };
}

test("GET /health should return ok", async () => {
  const { app } = createTestSetup();

  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
});

test("POST /v1/events should return 401 without bearer token", async () => {
  const { app } = createTestSetup();

  const response = await request(app).post("/v1/events").send(validPayload());

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "unauthorized");
});

test("POST /v1/events should return 400 for invalid payload", async () => {
  const { app } = createTestSetup();

  const response = await request(app)
    .post("/v1/events")
    .set("Authorization", "Bearer test-token")
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "invalid_payload");
  assert.ok(Array.isArray(response.body.details));
  assert.ok(response.body.details.length > 0);
});

test("POST /v1/events should return 202 for valid payload", async () => {
  const { app } = createTestSetup();

  const response = await request(app)
    .post("/v1/events")
    .set("Authorization", "Bearer test-token")
    .send(validPayload());

  assert.equal(response.status, 202);
  assert.equal(response.body.status, "accepted");
  assert.ok(response.body.request_id);
  assert.ok(response.body.idempotency_key);
});

test("POST /v1/events should return 409 on duplicate payload", async () => {
  const { app } = createTestSetup();
  const payload = validPayload();

  const firstResponse = await request(app)
    .post("/v1/events")
    .set("Authorization", "Bearer test-token")
    .send(payload);

  const secondResponse = await request(app)
    .post("/v1/events")
    .set("Authorization", "Bearer test-token")
    .send(payload);

  assert.equal(firstResponse.status, 202);
  assert.equal(secondResponse.status, 409);
  assert.equal(secondResponse.body.error, "duplicate_event");
});

test("POST /v1/events should write to DLQ on Brevo send failure", async () => {
  const setup = createTestSetup();
  const failingPush = async () => ({
    sent: false,
    mode: "http_error",
    reason: "brevo_status_500",
  });

  const app = createApp({
    config: {
      relayApiToken: "test-token",
      brevoEnabled: true,
      brevoApiKey: "key",
      brevoEventsUrl: "https://api.brevo.com/v3/events",
      idempotencyTtlHours: 24,
      useRedisIdempotency: false,
      redisUrl: "redis://127.0.0.1:6379",
      dlqEnabled: true,
      dlqFilePath: "./dlq-events.log",
      defaultCurrency: "EUR",
    },
    idempotencyStore: new InMemoryIdempotencyStore(24),
    dlqWriter: {
      write: async (entry) => {
        setup.dlqEntries.push(entry);
      },
    },
    pushBrevoEvent: failingPush,
  });

  const response = await request(app)
    .post("/v1/events")
    .set("Authorization", "Bearer test-token")
    .send(validPayload());

  assert.equal(response.status, 202);
  assert.equal(setup.dlqEntries.length, 1);
  assert.equal(setup.dlqEntries[0].reason, "brevo_status_500");
});
