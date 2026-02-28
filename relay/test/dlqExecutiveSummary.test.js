const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildRecommendations,
  buildMarkdown,
  generateExecutiveSummary,
} = require("../src/dlqExecutiveSummary");

test("buildRecommendations should return actionable items when below targets", () => {
  const recommendations = buildRecommendations(
    {
      avg_replay_rate: 0.8,
      avg_failure_rate: 0.1,
      remaining_last: 5,
    },
    0.95,
    0.03,
  );

  assert.ok(recommendations.length >= 2);
});

test("buildMarkdown should include scorecard sections", () => {
  const markdown = buildMarkdown({
    generatedAt: "2026-02-27T12:00:00.000Z",
    summary: {
      window_days: 7,
      days_with_data: 7,
      total: 100,
      replayed: 95,
      failed: 3,
      malformed: 2,
      avg_replay_rate: 0.95,
      avg_failure_rate: 0.03,
      avg_duration_ms: 120,
      remaining_last: 1,
    },
    targetReplayRate: 0.95,
    targetFailureRate: 0.03,
  });

  assert.ok(markdown.includes("# Executive Summary — DLQ KPI (hebdomadaire)"));
  assert.ok(markdown.includes("## Scorecard"));
  assert.ok(markdown.includes("## Recommendations"));
});

test("generateExecutiveSummary should write markdown output", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relay-summary-"));
  const source = path.join(dir, "daily.log");
  const target = path.join(dir, "summary.md");

  const sourceData = [
    JSON.stringify({
      type: "dlq_daily_kpi",
      generated_at: "2026-02-27T09:00:00.000Z",
      summary: {
        date: "2026-02-27",
        timezone: "UTC",
        runs: 1,
        total: 10,
        replayed: 9,
        failed: 1,
        malformed: 0,
        remaining_last: 1,
        avg_duration_ms: 100,
        replay_rate: 0.9,
        failure_rate: 0.1,
      },
    }),
  ].join("\n");

  await fs.writeFile(source, `${sourceData}\n`, "utf8");

  const result = await generateExecutiveSummary({
    sourcePath: source,
    targetPath: target,
    nowIso: "2026-02-27T23:59:59.000Z",
    lookbackDays: 7,
    config: {
      dlqDailyReportFilePath: source,
      dlqExecSummaryFilePath: target,
      dlqTargetReplayRate: 0.95,
      dlqTargetFailureRate: 0.03,
    },
  });

  assert.equal(result.type, "dlq_executive_summary");
  const content = await fs.readFile(target, "utf8");
  assert.ok(content.includes("Executive Summary"));
  assert.ok(content.includes("Recommendations"));
});
