import { pushAllAppStateToCloud } from "@/lib/appStateCloud";
import { resetCloudWriteFailures } from "@/lib/cloudWrite";
import { pushAllReviewsToCloud } from "@/lib/reviews";
import { pushAllLocalSessionsToCloud } from "@/lib/sessionsCloud";

const FLUSH_TIMEOUT_MS = 5000;

/** 登出前完整推送。逾時不取消 in-flight，回傳 timedOut 讓 UI 決定。 */
export async function flushLocalToCloud(timeoutMs = FLUSH_TIMEOUT_MS): Promise<{ timedOut: boolean }> {
  const work = Promise.all([
    pushAllLocalSessionsToCloud(),
    pushAllAppStateToCloud(),
    pushAllReviewsToCloud(),
  ]).then(() => undefined);

  const raced = await Promise.race([
    work.then(() => ({ timedOut: false as const })),
    new Promise<{ timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    }),
  ]);

  if (!raced.timedOut) resetCloudWriteFailures();
  return raced;
}
