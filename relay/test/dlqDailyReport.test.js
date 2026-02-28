const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  aggregateDailyKpi,
  generateDailyReport,
} = require("../src/dlqDailyReport");

test("aggregateDailyKpi should compute rates and totals", () => {
  const entries = [
    {
      generated_at: "2026-02-27T08:00:00.000Z",
      summary: {
        total: 10,
        replayed: 7,
        failed: 2,
        malformed: 1,
        remaining: 3,
        duration_ms: 100,
      },
    },
    {
      generated_at: "2026-02-27T12:00:00.000Z",
      summary: {
        total: 8,
        replayed: 6,
        failed: 1,
        malformed: 1,
        remaining: 2,
        duration_ms: 300,
      },
    },
  ];

  const kpi = aggregateDailyKpi(entries, "2026-02-27", "UTC");

  assert.equal(kpi.runs, 2);
  assert.equal(kpi.total, 18);
  assert.equal(kpi.replayed, 13);
  assert.equal(kpi.failed, 3);
  assert.equal(kpi.malformed, 2);
  assert.equal(kpi.remaining_last, 2);
  assert.equal(kpi.avg_duration_ms, 200);
  assert.equal(kpi.replay_rate, Number((13 / 18).toFixed(4)));
  assert.equal(kpi.failure_rate, Number((3 / 18).toFixed(4)));
});

test("generateDailyReport should append one report line", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relay-daily-"));
  const source = path.join(dir, "replay.log");
  const target = path.join(dir, "daily.log");

  const sourceData = [
    JSON.stringify({
      type: "dlq_replay_summary",
      generated_at: "2026-02-27T09:00:00.000Z",
      summary: {
        total: 5,
        replayed: 4,
        failed: 1,
        malformed: 0,
        remaining: 1,
        duration_ms: 120,
      },
    }),
  ].join("\n");

  await fs.writeFile(source, `${sourceData}\n`, "utf8");

  const report = await generateDailyReport({
    sourcePath: source,
    targetPath: target,
    timezone: "UTC",
    date: "2026-02-27",
  });

  assert.equal(report.type, "dlq_daily_kpi");
  assert.equal(report.summary.runs, 1);
  assert.equal(report.summary.total, 5);

  const written = await fs.readFile(target, "utf8");
  const lines = written.split("\n").filter(Boolean);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.type, "dlq_daily_kpi");
});
