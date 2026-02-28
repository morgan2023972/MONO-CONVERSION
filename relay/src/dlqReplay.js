const fs = require("fs/promises");
const path = require("path");

const config = require("./config");
const { toBrevoEvent } = require("./transform");
const { pushBrevoEvent } = require("./brevoClient");
const ReplayReportWriter = require("./replayReportWriter");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readDlqEntries(filePath) {
  const absolutePath = path.resolve(filePath);

  try {
    const content = await fs.readFile(absolutePath, "utf8");
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (_error) {
        entries.push({ malformed: true, raw_line: line });
      }
    }

    return entries;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeDlqEntries(filePath, entries) {
  const absolutePath = path.resolve(filePath);
  if (!entries.length) {
    await fs.writeFile(absolutePath, "", "utf8");
    return;
  }

  const data = `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  await fs.writeFile(absolutePath, data, "utf8");
}

async function replayDlqEntries(options = {}) {
  const runtimeConfig = options.config || config;
  const runtimePushBrevoEvent = options.pushBrevoEvent || pushBrevoEvent;
  const runtimeReportWriter =
    options.reportWriter ||
    new ReplayReportWriter(runtimeConfig.dlqReportFilePath);
  const filePath = options.filePath || runtimeConfig.dlqFilePath;
  const maxAttempts = Number(
    options.maxAttempts || process.env.DLQ_REPLAY_MAX_ATTEMPTS || 3,
  );
  const baseDelayMs = Number(
    options.baseDelayMs || process.env.DLQ_REPLAY_BASE_DELAY_MS || 250,
  );

  const startedAt = new Date();
  const entries = await readDlqEntries(filePath);
  const remainingEntries = [];

  const summary = {
    total: entries.length,
    replayed: 0,
    failed: 0,
    malformed: 0,
    remaining: 0,
  };

  for (const entry of entries) {
    if (entry.malformed || !entry.payload) {
      summary.malformed += 1;
      remainingEntries.push(entry);
      continue;
    }

    const brevoData = toBrevoEvent(
      entry.payload,
      runtimeConfig.defaultCurrency,
    );

    let result = null;
    let sent = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        result = await runtimePushBrevoEvent({
          enabled: runtimeConfig.brevoEnabled,
          apiKey: runtimeConfig.brevoApiKey,
          eventsUrl: runtimeConfig.brevoEventsUrl,
          eventName: brevoData.eventName,
          identifiers: brevoData.identifiers,
          eventData: brevoData.eventData,
        });
      } catch (error) {
        result = {
          sent: false,
          mode: "exception",
          reason: error.message,
        };
      }

      if (result && result.sent) {
        sent = true;
        break;
      }

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }

    if (sent) {
      summary.replayed += 1;
      continue;
    }

    summary.failed += 1;
    remainingEntries.push({
      ...entry,
      replay_meta: {
        replayed_at: new Date().toISOString(),
        replay_attempts: maxAttempts,
        replay_reason: (result && (result.reason || result.mode)) || "unknown",
      },
    });
  }

  summary.remaining = remainingEntries.length;
  summary.started_at = startedAt.toISOString();
  summary.finished_at = new Date().toISOString();
  summary.duration_ms =
    new Date(summary.finished_at).getTime() - startedAt.getTime();
  await writeDlqEntries(filePath, remainingEntries);

  if (runtimeConfig.dlqReportEnabled) {
    try {
      await runtimeReportWriter.write({
        type: "dlq_replay_summary",
        generated_at: summary.finished_at,
        file_path: path.resolve(filePath),
        summary,
      });
    } catch (error) {
      console.error("[relay] dlq_report_write_error", error);
    }
  }

  return summary;
}

if (require.main === module) {
  replayDlqEntries()
    .then((summary) => {
      console.info("[relay] dlq_replay_summary", summary);
    })
    .catch((error) => {
      console.error("[relay] dlq_replay_error", error);
      process.exitCode = 1;
    });
}

module.exports = {
  readDlqEntries,
  writeDlqEntries,
  replayDlqEntries,
};
