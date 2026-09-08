import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ROUTINE,
  DEFAULT_WORKPLACES,
  type CourseInfo,
  type DayOverride,
  type DayPlan,
  type RoutineBlock,
  type ScheduleData,
  type WorkplaceConfig,
} from "@/lib/schedule";

/** 僅後端使用：service-role client（絕不可 "use client"／前端 import） */
function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("missing supabase admin env");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asRoutine(v: unknown): RoutineBlock[] {
  return Array.isArray(v) && v.length > 0 ? (v as RoutineBlock[]) : DEFAULT_ROUTINE;
}

function asWorkplaces(v: unknown): WorkplaceConfig[] {
  return Array.isArray(v) && v.length > 0 ? (v as WorkplaceConfig[]) : DEFAULT_WORKPLACES;
}

function asRecord<T>(v: unknown): Record<string, T> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {};
}

/** 只讀拉取 ROLO 使用者的行程相關 app_state；缺 key 給安全預設、不丟錯 */
export async function loadScheduleDataFor(userId: string): Promise<ScheduleData> {
  const empty: ScheduleData = {
    routine: DEFAULT_ROUTINE,
    dayPlans: {},
    dayOverrides: {},
    weekSchedule: {},
    workplaces: DEFAULT_WORKPLACES,
  };

  let sb: SupabaseClient;
  try {
    sb = createAdminClient();
  } catch {
    // 本機未設 SERVICE_ROLE_KEY 時回安全預設（結構仍可驗；正式環境必設）
    return empty;
  }

  const keys = ["routine", "day_plans", "day_overrides", "week_schedule", "workplaces"] as const;
  const { data, error } = await sb
    .from("app_state")
    .select("key,value")
    .eq("user_id", userId)
    .in("key", [...keys]);

  if (error) return empty;

  const byKey = new Map<string, unknown>();
  for (const row of data ?? []) {
    if (row && typeof row.key === "string") byKey.set(row.key, row.value);
  }

  return {
    routine: asRoutine(byKey.get("routine")),
    dayPlans: asRecord<DayPlan>(byKey.get("day_plans")),
    dayOverrides: asRecord<DayOverride>(byKey.get("day_overrides")),
    weekSchedule: asRecord<CourseInfo[]>(byKey.get("week_schedule")),
    workplaces: asWorkplaces(byKey.get("workplaces")),
  };
}
