const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name, fallback = "") {
  const value = process.env[name];
  if (!value || !value.trim()) {
    if (fallback) {
      return fallback;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  port: Number(process.env.PORT || 3001),
  relayApiToken: requireEnv("RELAY_API_TOKEN", "test-token"),
  brevoApiKey: process.env.BREVO_API_KEY || "",
  brevoEnabled:
    String(process.env.BREVO_ENABLED || "false").toLowerCase() === "true",
  brevoEventsUrl:
    process.env.BREVO_EVENTS_URL || "https://api.brevo.com/v3/events",
  idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 24),
  useRedisIdempotency:
    String(process.env.USE_REDIS_IDEMPOTENCY || "false").toLowerCase() ===
    "true",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  dlqEnabled:
    String(process.env.DLQ_ENABLED || "true").toLowerCase() === "true",
  dlqFilePath: process.env.DLQ_FILE_PATH || "./dlq-events.log",
  dlqReportEnabled:
    String(process.env.DLQ_REPORT_ENABLED || "true").toLowerCase() === "true",
  dlqReportFilePath:
    process.env.DLQ_REPORT_FILE_PATH || "./dlq-replay-report.log",
  dlqDailyReportFilePath:
    process.env.DLQ_DAILY_REPORT_FILE_PATH || "./dlq-daily-report.log",
  dlqDailyReportTimezone: process.env.DLQ_DAILY_REPORT_TIMEZONE || "UTC",
  dlqWeeklyReportFilePath:
    process.env.DLQ_WEEKLY_REPORT_FILE_PATH || "./dlq-weekly-report.log",
  dlqCsvExportFilePath:
    process.env.DLQ_CSV_EXPORT_FILE_PATH || "./dlq-kpi-export.csv",
  dlqExecSummaryFilePath:
    process.env.DLQ_EXEC_SUMMARY_FILE_PATH || "./dlq-executive-summary.md",
  dlqTargetReplayRate: Number(process.env.DLQ_TARGET_REPLAY_RATE || 0.95),
  dlqTargetFailureRate: Number(process.env.DLQ_TARGET_FAILURE_RATE || 0.03),
  defaultCurrency: process.env.DEFAULT_CURRENCY || "EUR",
};

module.exports = config;
