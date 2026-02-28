const fs = require("fs/promises");
const path = require("path");

const config = require("./config");
const { readJsonLines } = require("./dlqDailyReport");
const { extractDailyRows, aggregateWeekly } = require("./dlqKpiExport");

function statusLabel(ok) {
  return ok ? "✅ OK" : "⚠️ À surveiller";
}

function formatPct(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function buildRecommendations(summary, targetReplayRate, targetFailureRate) {
  const recommendations = [];

  if (summary.avg_replay_rate < targetReplayRate) {
    recommendations.push(
      `Augmenter la fréquence de replay et vérifier les causes d'échec Brevo (objectif replay_rate >= ${formatPct(targetReplayRate)}).`,
    );
  }

  if (summary.avg_failure_rate > targetFailureRate) {
    recommendations.push(
      `Réduire le failure_rate en traitant les erreurs API Brevo récurrentes (objectif <= ${formatPct(targetFailureRate)}).`,
    );
  }

  if (Number(summary.remaining_last || 0) > 0) {
    recommendations.push(
      "Purger le stock DLQ résiduel via replays supplémentaires ou correction des payloads malformés.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Conserver la cadence actuelle, les KPI sont dans la cible.",
    );
  }

  return recommendations;
}

function buildMarkdown({
  generatedAt,
  summary,
  targetReplayRate,
  targetFailureRate,
}) {
  const replayRateOk = Number(summary.avg_replay_rate || 0) >= targetReplayRate;
  const failureRateOk =
    Number(summary.avg_failure_rate || 0) <= targetFailureRate;

  const recommendations = buildRecommendations(
    summary,
    targetReplayRate,
    targetFailureRate,
  );

  const lines = [
    "# Executive Summary — DLQ KPI (hebdomadaire)",
    "",
    `Generated at: ${generatedAt}`,
    `Window: ${summary.window_days} jours`,
    "",
    "## Scorecard",
    `- Replay rate: ${formatPct(summary.avg_replay_rate)} (${statusLabel(replayRateOk)})`,
    `- Failure rate: ${formatPct(summary.avg_failure_rate)} (${statusLabel(failureRateOk)})`,
    `- Remaining last: ${summary.remaining_last}`,
    `- Days with data: ${summary.days_with_data}`,
    "",
    "## Volumes",
    `- Total events: ${summary.total}`,
    `- Replayed: ${summary.replayed}`,
    `- Failed: ${summary.failed}`,
    `- Malformed: ${summary.malformed}`,
    `- Avg duration: ${summary.avg_duration_ms} ms`,
    "",
    "## Targets",
    `- Target replay rate: ${formatPct(targetReplayRate)}`,
    `- Target failure rate: ${formatPct(targetFailureRate)}`,
    "",
    "## Recommendations",
    ...recommendations.map((item) => `- ${item}`),
    "",
  ];

  return lines.join("\n");
}

async function writeSummary(filePath, markdown) {
  const absolutePath = path.resolve(filePath);
  await fs.writeFile(absolutePath, markdown, "utf8");
}

async function generateExecutiveSummary(options = {}) {
  const runtimeConfig = options.config || config;
  const sourcePath = options.sourcePath || runtimeConfig.dlqDailyReportFilePath;
  const targetPath = options.targetPath || runtimeConfig.dlqExecSummaryFilePath;
  const nowIso = options.nowIso || new Date().toISOString();
  const lookbackDays = Number(options.lookbackDays || 7);

  const entries = await readJsonLines(sourcePath);
  const rows = extractDailyRows(entries);
  const summary = aggregateWeekly(rows, nowIso, lookbackDays);

  const markdown = buildMarkdown({
    generatedAt: new Date().toISOString(),
    summary,
    targetReplayRate: runtimeConfig.dlqTargetReplayRate,
    targetFailureRate: runtimeConfig.dlqTargetFailureRate,
  });

  await writeSummary(targetPath, markdown);

  return {
    type: "dlq_executive_summary",
    generated_at: new Date().toISOString(),
    source_file_path: path.resolve(sourcePath),
    target_file_path: path.resolve(targetPath),
    summary,
  };
}

if (require.main === module) {
  generateExecutiveSummary()
    .then((result) => {
      console.info("[relay] dlq_executive_summary", result);
    })
    .catch((error) => {
      console.error("[relay] dlq_executive_summary_error", error);
      process.exitCode = 1;
    });
}

module.exports = {
  buildRecommendations,
  buildMarkdown,
  generateExecutiveSummary,
};
