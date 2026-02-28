async function pushBrevoEvent({
  enabled,
  apiKey,
  eventsUrl,
  eventName,
  identifiers,
  eventData,
  fetchImpl,
}) {
  if (!enabled) {
    return {
      sent: false,
      mode: "disabled",
      reason: "BREVO_ENABLED=false",
    };
  }

  if (!apiKey) {
    return {
      sent: false,
      mode: "disabled",
      reason: "missing_api_key",
    };
  }

  const httpClient = fetchImpl || globalThis.fetch;

  if (typeof httpClient !== "function") {
    return {
      sent: false,
      mode: "error",
      reason: "fetch_not_available",
    };
  }

  const payload = {
    event_name: eventName,
    identifiers,
    event_data: eventData,
  };

  const response = await httpClient(eventsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      sent: false,
      mode: "http_error",
      reason: `brevo_status_${response.status}`,
      status: response.status,
      body,
    };
  }

  return {
    sent: true,
    mode: "live",
  };
}

module.exports = { pushBrevoEvent };
