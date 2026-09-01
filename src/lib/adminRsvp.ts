import { getAdminSupabase } from "./supabase";
import type { Attend, Meal, Side } from "./rsvp";

export interface RsvpRow {
  id: string;
  side: Side;
  attend: Attend;
  name: string;
  count: number;
  meal: Meal;
  phone: string;
  created_at: string;
}

const TABLE = "rsvp";

export async function listRsvp(): Promise<RsvpRow[]> {
  const { data, error } = await getAdminSupabase().from(TABLE).select("*").order("created_at", { ascending: false });

  if (error) throw new Error(`회신 조회 실패 (${error.code || "unknown"}): ${error.message}`);
  return (data ?? []) as RsvpRow[];
}

export async function deleteRsvp(id: string): Promise<void> {
  const { data, error } = await getAdminSupabase().from(TABLE).delete().eq("id", id).select("id");

  if (error) throw new Error(`회신 삭제 실패 (${error.code || "unknown"}): ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("회신 삭제 실패: 지워진 행이 없습니다 — 권한이 없거나 이미 지워진 회신입니다");
  }
}

export interface RsvpSummary {
  responses: number;
  attending: number;
  absent: number;
  headcount: number;
  meals: Record<Meal, number>;
  side: Record<Side, number>;
  sideHeadcount: Record<Side, number>;
}

export function summarize(rows: readonly RsvpRow[]): RsvpSummary {
  const summary: RsvpSummary = {
    responses: rows.length,
    attending: 0,
    absent: 0,
    headcount: 0,
    meals: { 식사함: 0, 식사안함: 0, 미정: 0 },
    side: { 신랑측: 0, 신부측: 0 },
    sideHeadcount: { 신랑측: 0, 신부측: 0 },
  };

  for (const row of rows) {
    summary.side[row.side] += 1;

    if (row.attend !== "참석") {
      summary.absent += 1;
      continue;
    }
    summary.attending += 1;
    summary.headcount += row.count;
    summary.meals[row.meal] += row.count;
    summary.sideHeadcount[row.side] += row.count;
  }
  return summary;
}
