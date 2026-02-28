const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  aggregateWeekly,
  toCsv,
  generateWeeklyReport,
  exportCsv,
} = require("../src/dlqKpiExport");

test("aggregateWeekly should compute 7-day summary", () => {
  const rows = [
    {
      generated_at: "2026-02-27T10:00:00.000Z",
      total: 10,
      replayed: 8,
      failed: 1,
      malformed: 1,
      avg_duration_ms: 100,
      replay_rate: 0.8,
      failure_rate: 0.1,
      remaining_last: 2,
    },
    {
      generated_at: "2026-02-25T10:00:00.000Z",
      total: 12,
      replayed: 10,
      failed: 1,
      malformed: 1,
      avg_duration_ms: 200,
      replay_rate: 0.8333,
      failure_rate: 0.0833,
      remaining_last: 1,
    },
    {
      generated_at: "2026-02-10T10:00:00.000Z",
      total: 50,
      replayed: 40,
      failed: 5,
      malformed: 5,
      avg_duration_ms: 300,
      replay_rate: 0.8,
      failure_rate: 0.1,
      remaining_last: 5,
    },
  ];

  const summary = aggregateWeekly(rows, "2026-02-27T23:59:59.000Z", 7);

  assert.equal(summary.days_with_data, 2);
  assert.equal(summary.total, 22);
  assert.equal(summary.replayed, 18);
  assert.equal(summary.failed, 2);
  assert.equal(summary.malformed, 2);
  assert.equal(summary.remaining_last, 1);
});

test("toCsv should produce header and rows", () => {
  const csv = toCsv([
    {
      date: "2026-02-27",
      timezone: "UTC",
      runs: 1,
      total: 5,
      replayed: 4,
      failed: 1,
      malformed: 0,
      remaining_last: 1,
      avg_duration_ms: 120,
      replay_rate: 0.8,
      failure_rate: 0.2,
      generated_at: "2026-02-27T10:00:00.000Z",
    },
  ]);

  assert.ok(csv.includes("date,timezone,runs"));
  assert.ok(csv.includes("2026-02-27"));
});

test("generateWeeklyReport and exportCsv should write outputs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relay-weekly-"));
  const source = path.join(dir, "daily.log");
  const weeklyTarget = path.join(dir, "weekly.log");
  const csvTarget = path.join(dir, "kpi.csv");

  const dailyEntries = [
    JSON.stringify({
      type: "dlq_daily_kpi",
      generated_at: "2026-02-27T10:00:00.000Z",
      summary: {
        date: "2026-02-27",
        timezone: "UTC",
        runs: 1,
        total: 7,
        replayed: 6,
        failed: 1,
        malformed: 0,
        remaining_last: 1,
        avg_duration_ms: 100,
        replay_rate: 0.8571,
        failure_rate: 0.1429,
      },
    }),
  ].join("\n");

  await fs.writeFile(source, `${dailyEntries}\n`, "utf8");

  const weekly = await generateWeeklyReport({
    sourcePath: source,
    targetPath: weeklyTarget,
    nowIso: "2026-02-27T23:59:59.000Z",
  });
  assert.equal(weekly.type, "dlq_weekly_kpi");

  const csv = await exportCsv({
    sourcePath: source,
    targetPath: csvTarget,
  });
  assert.equal(csv.type, "dlq_csv_export");

  const weeklyContent = await fs.readFile(weeklyTarget, "utf8");
  assert.ok(weeklyContent.includes("dlq_weekly_kpi"));

  const csvContent = await fs.readFile(csvTarget, "utf8");
  assert.ok(csvContent.includes("date,timezone,runs"));
});
