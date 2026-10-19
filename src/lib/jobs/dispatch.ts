import "server-only";
import { env } from "@/lib/env";
import { inngest } from "@/lib/jobs/inngest";
import { publishTarget, recomputePostStatus, runPost } from "@/lib/publishing";
import { analyzeAsset } from "@/lib/ai/service";

// Envia trabalho para o Inngest. Sem Inngest configurado (dev/testes), corre neste processo.

const timers = (globalThis as unknown as { __ppTimers?: Map<string, NodeJS.Timeout> });
timers.__ppTimers ??= new Map();

function runLater(key: string, at: Date, fn: () => Promise<unknown>) {
  const existing = timers.__ppTimers!.get(key);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, Math.min(at.getTime() - Date.now(), 2_147_000_000));
  timers.__ppTimers!.set(key, setTimeout(() => {
    timers.__ppTimers!.delete(key);
    fn().catch((e) => console.error(`[jobs] ${key}`, e));
  }, delay));
}

export async function dispatchScheduledPost(postId: string, version: number, scheduledAt: Date) {
  if (env.inngestEnabled()) {
    await inngest.send({ name: "post/scheduled", id: `post-${postId}-v${version}`, data: { postId, version, scheduledAt: scheduledAt.toISOString() } });
  } else {
    runLater(`post:${postId}`, scheduledAt, () => runPost(postId, version));
  }
}

export async function dispatchRetryTarget(targetId: string, postId: string) {
  if (env.inngestEnabled()) {
    await inngest.send({ name: "target/retry", data: { targetId, postId } });
  } else {
    runLater(`target:${targetId}`, new Date(), async () => {
      await publishTarget(targetId);
      await recomputePostStatus(postId);
    });
  }
}

export async function dispatchAnalyzeAsset(assetId: string) {
  if (env.inngestEnabled()) {
    await inngest.send({ name: "media/uploaded", data: { assetId } });
  } else {
    runLater(`analyze:${assetId}`, new Date(), () => analyzeAsset(assetId));
  }
}
