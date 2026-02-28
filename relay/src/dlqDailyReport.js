const fs = require("fs/promises");
const path = require("path");

const config = require("./config");

async function readJsonLines(filePath) {
  const absolutePath = path.resolve(filePath);

  try {
    const content = await fs.readFile(absolutePath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function toLocalDateKey(isoDate, timezone) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function aggregateDailyKpi(entries, dateKey, timezone) {
  const matchingEntries = entries.filter((entry) => {
    if (!entry.generated_at || !entry.summary) {
      return false;
    }
    return toLocalDateKey(entry.generated_at, timezone) === dateKey;
  });

  const kpi = {
    date: dateKey,
    timezone,
    runs: matchingEntries.length,
    total: 0,
    replayed: 0,
    failed: 0,
    malformed: 0,
    remaining_last: 0,
    avg_duration_ms: 0,
    replay_rate: 0,
    failure_rate: 0,
  };

  if (matchingEntries.length === 0) {
    return kpi;
  }

  let durationSum = 0;

  for (const entry of matchingEntries) {
    const summary = entry.summary;
    kpi.total += Number(summary.total || 0);
    kpi.replayed += Number(summary.replayed || 0);
    kpi.failed += Number(summary.failed || 0);
    kpi.malformed += Number(summary.malformed || 0);
    durationSum += Number(summary.duration_ms || 0);
  }

  const lastEntry = matchingEntries[matchingEntries.length - 1];
  kpi.remaining_last = Number(lastEntry.summary.remaining || 0);
  kpi.avg_duration_ms = Math.round(durationSum / matchingEntries.length);

  if (kpi.total > 0) {
    kpi.replay_rate = Number((kpi.replayed / kpi.total).toFixed(4));
    kpi.failure_rate = Number((kpi.failed / kpi.total).toFixed(4));
  }

  return kpi;
}

async function appendDailyReport(filePath, report) {
  const absolutePath = path.resolve(filePath);
  const line = `${JSON.stringify(report)}\n`;
  await fs.appendFile(absolutePath, line, "utf8");
}

async function generateDailyReport(options = {}) {
  const runtimeConfig = options.config || config;
  const sourcePath = options.sourcePath || runtimeConfig.dlqReportFilePath;
  const targetPath = options.targetPath || runtimeConfig.dlqDailyReportFilePath;
  const timezone = options.timezone || runtimeConfig.dlqDailyReportTimezone;

  const now = options.now ? new Date(options.now) : new Date();
  const dateKey =
    options.date ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

  const entries = await readJsonLines(sourcePath);
  const summary = aggregateDailyKpi(entries, dateKey, timezone);

  const report = {
    type: "dlq_daily_kpi",
    generated_at: new Date().toISOString(),
    source_file_path: path.resolve(sourcePath),
    summary,
  };

  await appendDailyReport(targetPath, report);
  return report;
}

if (require.main === module) {
  generateDailyReport({
    date: process.env.DLQ_DAILY_REPORT_DATE || undefined,
  })
    .then((report) => {
      console.info("[relay] dlq_daily_report", report.summary);
    })
    .catch((error) => {
      console.error("[relay] dlq_daily_report_error", error);
      process.exitCode = 1;
    });
}

module.exports = {
  readJsonLines,
  aggregateDailyKpi,
  generateDailyReport,
};
