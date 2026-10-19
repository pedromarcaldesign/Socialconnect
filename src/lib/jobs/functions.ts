import "server-only";
import { inngest } from "@/lib/jobs/inngest";
import { claimPost, publishTarget, recomputePostStatus, duePosts, runPost } from "@/lib/publishing";
import { healthcheckAccounts } from "@/lib/meta/accounts";
import { analyzeAsset } from "@/lib/ai/service";

const MAX_ATTEMPTS = 4;

/** Espera pela hora marcada e publica em cada rede. Um reagendamento muda a versão e este job termina sem fazer nada. */
export const publishScheduledPost = inngest.createFunction(
  { id: "publish-scheduled-post", triggers: [{ event: "post/scheduled" }], retries: 2 },
  async ({ event, step }) => {
    const { postId, version, scheduledAt } = event.data as { postId: string; version: number; scheduledAt: string };
    await step.sleepUntil("wait-for-time", new Date(scheduledAt));
    const targetIds = await step.run("claim", () => claimPost(postId, version));
    if (!targetIds) return { skipped: true };

    await Promise.all(targetIds.map(async (id) => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const result = await step.run(`publish-${id}-${attempt}`, () => publishTarget(id));
        if (result.ok || !result.retryable) return;
        if (attempt < MAX_ATTEMPTS) await step.sleep(`backoff-${id}-${attempt}`, `${30 * attempt}s`);
      }
    }));
    return step.run("finalize", () => recomputePostStatus(postId));
  },
);

/** Repetir um target que falhou, a pedido do utilizador. */
export const retryTarget = inngest.createFunction(
  { id: "retry-target", triggers: [{ event: "target/retry" }], retries: 0 },
  async ({ event, step }) => {
    const { targetId, postId } = event.data as { targetId: string; postId: string };
    await step.run("publish", () => publishTarget(targetId));
    return step.run("finalize", () => recomputePostStatus(postId));
  },
);

/** Rede de segurança: publica posts cuja hora passou e que nenhum job apanhou. */
export const sweepDuePosts = inngest.createFunction(
  { id: "sweep-due-posts", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const due = await step.run("find", () => duePosts(new Date(Date.now() - 2 * 60_000)));
    for (const p of due) await step.run(`run-${p.id}`, () => runPost(p.id, p.scheduleVersion));
    return { ran: due.length };
  },
);

export const dailyHealthcheck = inngest.createFunction(
  { id: "accounts-healthcheck", triggers: [{ cron: "TZ=Europe/Lisbon 0 7 * * *" }] },
  async ({ step }) => step.run("check", () => healthcheckAccounts()),
);

export const analyzeUploadedAsset = inngest.createFunction(
  { id: "analyze-asset", triggers: [{ event: "media/uploaded" }], retries: 2, concurrency: { limit: 3 } },
  async ({ event, step }) => step.run("analyze", () => analyzeAsset((event.data as { assetId: string }).assetId)),
);

export const functions = [publishScheduledPost, retryTarget, sweepDuePosts, dailyHealthcheck, analyzeUploadedAsset];
