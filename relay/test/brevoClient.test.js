const test = require("node:test");
const assert = require("node:assert/strict");

const { pushBrevoEvent } = require("../src/brevoClient");

test("pushBrevoEvent should call Brevo endpoint when enabled", async () => {
  let calledUrl = "";
  let calledOptions = null;

  const fakeFetch = async (url, options) => {
    calledUrl = url;
    calledOptions = options;
    return {
      ok: true,
      status: 201,
      text: async () => "",
    };
  };

  const result = await pushBrevoEvent({
    enabled: true,
    apiKey: "brevo-key",
    eventsUrl: "https://api.brevo.com/v3/events",
    eventName: "add_to_cart",
    identifiers: { email: "john@example.com" },
    eventData: { shop: "mono-conversion.myshopify.com" },
    fetchImpl: fakeFetch,
  });

  assert.equal(result.sent, true);
  assert.equal(result.mode, "live");
  assert.equal(calledUrl, "https://api.brevo.com/v3/events");
  assert.equal(calledOptions.method, "POST");
  assert.equal(calledOptions.headers["api-key"], "brevo-key");

  const body = JSON.parse(calledOptions.body);
  assert.equal(body.event_name, "add_to_cart");
  assert.deepEqual(body.identifiers, { email: "john@example.com" });
});

test("pushBrevoEvent should return http_error on non-2xx response", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 500,
    text: async () => "internal",
  });

  const result = await pushBrevoEvent({
    enabled: true,
    apiKey: "brevo-key",
    eventsUrl: "https://api.brevo.com/v3/events",
    eventName: "view_item",
    identifiers: {},
    eventData: { shop: "mono-conversion.myshopify.com" },
    fetchImpl: fakeFetch,
  });

  assert.equal(result.sent, false);
  assert.equal(result.mode, "http_error");
  assert.equal(result.reason, "brevo_status_500");
});
