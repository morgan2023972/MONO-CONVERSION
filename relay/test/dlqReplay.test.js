const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { replayDlqEntries, readDlqEntries } = require("../src/dlqReplay");

async function createTempDlqFile(lines) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relay-dlq-"));
  const filePath = path.join(dir, "dlq-events.log");
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
  return { dir, filePath };
}

test("replayDlqEntries should remove entries when replay succeeds", async () => {
  const payload = {
    event: "add_to_cart",
    shop: "mono-conversion.myshopify.com",
    template: "product",
    timestamp: "2026-02-27T10:15:10.123Z",
    funnel_step: "product",
  };

  const { filePath } = await createTempDlqFile([
    JSON.stringify({ payload, reason: "brevo_status_500" }),
  ]);

  const reports = [];

  const summary = await replayDlqEntries({
    filePath,
    config: {
      brevoEnabled: true,
      brevoApiKey: "key",
      brevoEventsUrl: "https://api.brevo.com/v3/events",
      dlqReportEnabled: true,
      dlqReportFilePath: "./dlq-replay-report.log",
      defaultCurrency: "EUR",
    },
    maxAttempts: 1,
    reportWriter: {
      write: async (entry) => {
        reports.push(entry);
      },
    },
    pushBrevoEvent: async () => ({ sent: true, mode: "live" }),
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.replayed, 1);
  assert.equal(summary.remaining, 0);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].type, "dlq_replay_summary");

  const entries = await readDlqEntries(filePath);
  assert.equal(entries.length, 0);
});

test("replayDlqEntries should keep entries when replay fails", async () => {
  const payload = {
    event: "view_item",
    shop: "mono-conversion.myshopify.com",
    template: "product",
    timestamp: "2026-02-27T10:15:10.123Z",
    funnel_step: "product",
  };

  const { filePath } = await createTempDlqFile([
    JSON.stringify({ payload, reason: "brevo_status_500" }),
  ]);

  const summary = await replayDlqEntries({
    filePath,
    config: {
      brevoEnabled: true,
      brevoApiKey: "key",
      brevoEventsUrl: "https://api.brevo.com/v3/events",
      dlqReportEnabled: false,
      defaultCurrency: "EUR",
    },
    maxAttempts: 1,
    pushBrevoEvent: async () => ({
      sent: false,
      mode: "http_error",
      reason: "brevo_status_500",
    }),
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.remaining, 1);

  const entries = await readDlqEntries(filePath);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].replay_meta.replay_reason, "brevo_status_500");
});
