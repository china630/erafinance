import type { Logger } from "@nestjs/common";
import type { Job, Worker } from "bullmq";

/**
 * Optional webhook for failed BullMQ jobs (Slack incoming webhook, Telegram Bot API, etc.).
 * Env: `ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL`.
 */
export function attachWorkerFailureAlert(
  worker: Worker,
  queueName: string,
  logger: Logger,
  webhookUrl: string | undefined,
): void {
  worker.on("failed", (job: Job | undefined, err: Error) => {
    const msg = err?.message ?? String(err);
    logger.error(`[${queueName}] job ${job?.id ?? "?"} failed: ${msg}`);
    void postOptionalWebhook(webhookUrl, queueName, job?.id, msg);
  });
}

async function postOptionalWebhook(
  webhookUrl: string | undefined,
  queueName: string,
  jobId: string | number | undefined,
  errorMessage: string,
): Promise<void> {
  const url = webhookUrl?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `ERA BullMQ: queue=${queueName} jobId=${jobId ?? "?"} error=${errorMessage}`,
        source: "bullmq-worker",
        queue: queueName,
        jobId: jobId ?? null,
        errorMessage,
        ts: new Date().toISOString(),
      }),
    });
  } catch {
    // best-effort only
  }
}
