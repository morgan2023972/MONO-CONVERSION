const crypto = require("crypto");
const express = require("express");

const config = require("./config");
const { validateEvent } = require("./validator");
const InMemoryIdempotencyStore = require("./idempotencyStore");
const RedisIdempotencyStore = require("./redisIdempotencyStore");
const FileDlqWriter = require("./dlqWriter");
const { toBrevoEvent } = require("./transform");
const { pushBrevoEvent } = require("./brevoClient");

function createApp(options = {}) {
  const runtimeConfig = options.config || config;
  const runtimePushBrevoEvent = options.pushBrevoEvent || pushBrevoEvent;
  const runtimeDlqWriter =
    options.dlqWriter || new FileDlqWriter(runtimeConfig.dlqFilePath);
  const idempotencyStore =
    options.idempotencyStore ||
    (runtimeConfig.useRedisIdempotency
      ? new RedisIdempotencyStore(
          runtimeConfig.redisUrl,
          runtimeConfig.idempotencyTtlHours,
        )
      : new InMemoryIdempotencyStore(runtimeConfig.idempotencyTtlHours));

  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_, res) => {
    res.json({ status: "ok" });
  });

  app.post("/v1/events", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const expected = `Bearer ${runtimeConfig.relayApiToken}`;

    if (authHeader !== expected) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Missing or invalid bearer token",
      });
    }

    const payload = req.body || {};
    const validation = validateEvent(payload);

    if (!validation.valid) {
      return res.status(400).json({
        error: "invalid_payload",
        message: "Payload validation failed",
        details: validation.errors,
      });
    }

    const requestId = crypto.randomUUID();
    const idempotencyRaw = [
      payload.shop || "",
      payload.event || "",
      payload.timestamp || "",
      payload.session_id || "",
      payload.product_id || "",
      payload.cart_total || "",
    ].join("|");

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(idempotencyRaw)
      .digest("hex");

    try {
      if (await idempotencyStore.has(idempotencyKey)) {
        return res.status(409).json({
          error: "duplicate_event",
          message: "Event already processed within idempotency window",
          request_id: requestId,
        });
      }

      await idempotencyStore.set(idempotencyKey, requestId);
    } catch (error) {
      return res.status(500).json({
        error: "idempotency_unavailable",
        message: "Idempotency backend is unavailable",
      });
    }

    const brevoData = toBrevoEvent(payload, runtimeConfig.defaultCurrency);
    let brevoResult;

    try {
      brevoResult = await runtimePushBrevoEvent({
        enabled: runtimeConfig.brevoEnabled,
        apiKey: runtimeConfig.brevoApiKey,
        eventsUrl: runtimeConfig.brevoEventsUrl,
        eventName: brevoData.eventName,
        identifiers: brevoData.identifiers,
        eventData: brevoData.eventData,
      });
    } catch (error) {
      brevoResult = {
        sent: false,
        mode: "exception",
        reason: error.message,
      };
    }

    const shouldWriteDlq =
      runtimeConfig.dlqEnabled && brevoResult && !brevoResult.sent;
    if (shouldWriteDlq) {
      try {
        await runtimeDlqWriter.write({
          request_id: requestId,
          idempotency_key: idempotencyKey,
          received_at: new Date().toISOString(),
          reason: brevoResult.reason || brevoResult.mode || "unknown",
          payload,
        });
      } catch (error) {
        console.error("[relay] dlq_write_error", error);
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[relay] accepted_event", {
        requestId,
        event: payload.event,
        idempotencyKey,
        brevoResult,
      });
    }

    return res.status(202).json({
      status: "accepted",
      request_id: requestId,
      idempotency_key: idempotencyKey,
      received_at: new Date().toISOString(),
    });
  });

  app.use((err, _req, res, _next) => {
    console.error("[relay] unhandled_error", err);
    return res.status(500).json({
      error: "internal_error",
      message: "Unexpected server error",
    });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port, () => {
    console.info(`[relay] listening on port ${config.port}`);
  });
}

module.exports = { createApp };
