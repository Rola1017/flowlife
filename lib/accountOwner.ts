import { getLocalSession } from "@/lib/authState";
import {
  clearAllAppData,
  hasLocalAppData,
  loadOwnerUserId,
  saveOwnerUserId,
} from "@/lib/storage";

/**
 * 本機記住的 user_id vs 目前登入者。
 * 未登入不清除；相同不清除；首次登入且無資料不清除；不同且有資料才清。
 */
export function shouldWipe(
  storedOwner: string | null,
  currentUid: string | null,
  hasLocalData: boolean,
): boolean {
  if (currentUid == null || currentUid === "") return false;
  if (storedOwner === currentUid) return false;
  if (!hasLocalData) return false;
  return true;
}

async function currentUid(): Promise<string | null> {
  try {
    const s = await getLocalSession();
    return s.uid;
  } catch {
    return null;
  }
}

let inflight: Promise<{ wiped: boolean; uid: string | null }> | null = null;

/** 歸屬檢查：不符則清本機再寫入新 uid。mutex 避免三個 sync hook 並行重複清。 */
export function ensureAccountOwnership(): Promise<{ wiped: boolean; uid: string | null }> {
  if (inflight) return inflight;
  inflight = (async () => {
    const uid = await currentUid();
    const stored = loadOwnerUserId();
    const wipe = shouldWipe(stored, uid, hasLocalAppData());
    if (wipe) clearAllAppData();
    if (uid) saveOwnerUserId(uid);
    return { wiped: wipe, uid };
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
