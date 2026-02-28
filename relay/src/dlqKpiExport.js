const fs = require("fs/promises");
const path = require("path");

const config = require("./config");
const { readJsonLines } = require("./dlqDailyReport");

function asDate(value) {
  return new Date(value);
}

function dateDiffDays(fromIso, toIso) {
  const from = asDate(fromIso).getTime();
  const to = asDate(toIso).getTime();
  const diff = to - from;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function extractDailyRows(entries) {
  return entries
    .filter((entry) => entry && entry.type === "dlq_daily_kpi" && entry.summary)
    .map((entry) => ({
      generated_at: entry.generated_at,
      ...entry.summary,
    }))
    .sort((a, b) => new Date(a.generated_at) - new Date(b.generated_at));
}

function aggregateWeekly(rows, nowIso, lookbackDays = 7) {
  const selected = rows.filter((row) => {
    const d = dateDiffDays(row.generated_at, nowIso);
    return d >= 0 && d < lookbackDays;
  });

  const summary = {
    window_days: lookbackDays,
    days_with_data: selected.length,
    total: 0,
    replayed: 0,
    failed: 0,
    malformed: 0,
    avg_replay_rate: 0,
    avg_failure_rate: 0,
    avg_duration_ms: 0,
    remaining_last: 0,
  };

  if (selected.length === 0) {
    return summary;
  }

  let replayRateSum = 0;
  let failureRateSum = 0;
  let durationSum = 0;

  for (const row of selected) {
    summary.total += Number(row.total || 0);
    summary.replayed += Number(row.replayed || 0);
    summary.failed += Number(row.failed || 0);
    summary.malformed += Number(row.malformed || 0);
    replayRateSum += Number(row.replay_rate || 0);
    failureRateSum += Number(row.failure_rate || 0);
    durationSum += Number(row.avg_duration_ms || 0);
  }

  summary.remaining_last = Number(
    selected[selected.length - 1].remaining_last || 0,
  );
  summary.avg_replay_rate = Number(
    (replayRateSum / selected.length).toFixed(4),
  );
  summary.avg_failure_rate = Number(
    (failureRateSum / selected.length).toFixed(4),
  );
  summary.avg_duration_ms = Math.round(durationSum / selected.length);

  return summary;
}

function toCsv(rows) {
  const header = [
    "date",
    "timezone",
    "runs",
    "total",
    "replayed",
    "failed",
    "malformed",
    "remaining_last",
    "avg_duration_ms",
    "replay_rate",
    "failure_rate",
    "generated_at",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    const values = [
      row.date,
      row.timezone,
      row.runs,
      row.total,
      row.replayed,
      row.failed,
      row.malformed,
      row.remaining_last,
      row.avg_duration_ms,
      row.replay_rate,
      row.failure_rate,
      row.generated_at,
    ];

    lines.push(
      values
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

async function writeJsonLine(filePath, data) {
  const absolutePath = path.resolve(filePath);
  await fs.appendFile(absolutePath, `${JSON.stringify(data)}\n`, "utf8");
}

async function writeCsv(filePath, content) {
  const absolutePath = path.resolve(filePath);
  await fs.writeFile(absolutePath, content, "utf8");
}

async function generateWeeklyReport(options = {}) {
  const runtimeConfig = options.config || config;
  const sourcePath = options.sourcePath || runtimeConfig.dlqDailyReportFilePath;
  const targetPath =
    options.targetPath || runtimeConfig.dlqWeeklyReportFilePath;
  const nowIso = options.nowIso || new Date().toISOString();
  const lookbackDays = Number(options.lookbackDays || 7);

  const entries = await readJsonLines(sourcePath);
  const rows = extractDailyRows(entries);
  const summary = aggregateWeekly(rows, nowIso, lookbackDays);

  const report = {
    type: "dlq_weekly_kpi",
    generated_at: new Date().toISOString(),
    source_file_path: path.resolve(sourcePath),
    summary,
  };

  await writeJsonLine(targetPath, report);
  return report;
}

async function exportCsv(options = {}) {
  const runtimeConfig = options.config || config;
  const sourcePath = options.sourcePath || runtimeConfig.dlqDailyReportFilePath;
  const targetPath = options.targetPath || runtimeConfig.dlqCsvExportFilePath;

  const entries = await readJsonLines(sourcePath);
  const rows = extractDailyRows(entries);
  const csv = toCsv(rows);
  await writeCsv(targetPath, csv);

  return {
    type: "dlq_csv_export",
    generated_at: new Date().toISOString(),
    source_file_path: path.resolve(sourcePath),
    target_file_path: path.resolve(targetPath),
    rows: rows.length,
  };
}

if (require.main === module) {
  const mode = process.argv[2] || "weekly";
  const run = mode === "csv" ? exportCsv : generateWeeklyReport;

  run()
    .then((result) => {
      console.info(`[relay] ${result.type}`, result);
    })
    .catch((error) => {
      console.error("[relay] dlq_kpi_export_error", error);
      process.exitCode = 1;
    });
}

module.exports = {
  extractDailyRows,
  aggregateWeekly,
  toCsv,
  generateWeeklyReport,
  exportCsv,
};
