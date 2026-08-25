// SIS-22 — 관리자 페이지가 RSVP 응답을 읽고 지우는 경로. AD-01·RS-04.
//
// 하객 쪽(rsvp.ts)과 파일을 나눈 이유는 **번들 때문이다.** 관리자 화면은 lazy 로
// 갈라져 있어 하객은 이 코드를 내려받지 않는다. 같은 파일에 두면 갈라지지 않는다.
//
// 여기서 쓰는 권한은 전부 로그인 세션에서 나온다 — RLS 의 rsvp_admin_select ·
// rsvp_admin_delete 가 is_admin() 으로 판정한다(supabase/schema.sql). 로그인하지
// 않았거나 admin_users 에 없는 계정이면 **오류가 아니라 0건**이 돌아온다.
import { getAdminSupabase } from "./supabase";
import type { Attend, Meal, Side } from "./rsvp";

/** 회신 한 건. 컬럼 이름·타입이 supabase/schema.sql 의 rsvp 테이블과 1:1 이다. */
export interface RsvpRow {
  id: string;
  side: Side;
  attend: Attend;
  name: string;
  count: number;
  meal: Meal;
  phone: string;
  /** DB 가 UTC 로 돌려준다. 화면·CSV 에 쓸 때 KST 로 옮긴다 — csv.ts 참고 */
  created_at: string;
}

const TABLE = "rsvp";

/**
 * 회신 전체를 최신순으로 읽는다.
 *
 * **0건과 「권한이 없다」를 여기서 구분하지 않는다.** RLS 는 권한이 없으면 오류가
 * 아니라 빈 목록을 주기 때문에 이 함수만으로는 갈라낼 수 없다. 화면은 목록을
 * 그리기 전에 isAdmin()(adminAuth.ts)으로 권한을 먼저 확인해야 한다 — 그러지
 * 않으면 권한이 없는 계정에 「아직 회신이 없어요」가 뜬다.
 */
export async function listRsvp(): Promise<RsvpRow[]> {
  const { data, error } = await getAdminSupabase().from(TABLE).select("*").order("created_at", { ascending: false });

  if (error) throw new Error(`회신 조회 실패 (${error.code || "unknown"}): ${error.message}`);
  return (data ?? []) as RsvpRow[];
}

/**
 * 회신 한 건을 지운다 (AD-01).
 *
 * `select()` 를 붙여 **실제로 지워진 행을 확인한다.** 붙이지 않으면 권한이 없어
 * 한 건도 지우지 못한 경우에도 오류 없이 통과해, 화면에서는 지워진 것처럼 보이고
 * 새로고침하면 되살아난다. 지워진 행이 0건이면 실패로 본다.
 */
export async function deleteRsvp(id: string): Promise<void> {
  const { data, error } = await getAdminSupabase().from(TABLE).delete().eq("id", id).select("id");

  if (error) throw new Error(`회신 삭제 실패 (${error.code || "unknown"}): ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("회신 삭제 실패: 지워진 행이 없습니다 — 권한이 없거나 이미 지워진 회신입니다");
  }
}

/** 식수 조율에 쓰는 집계 (RS-04). */
export interface RsvpSummary {
  /** 회신 건수 (사람 수가 아니다) */
  responses: number;
  attending: number;
  absent: number;
  /** 참석 회신의 인원 합계. 미참석 회신의 count(1)는 세지 않는다 */
  headcount: number;
  /** 참석자 중 식사 여부별 인원 합계 */
  meals: Record<Meal, number>;
  /** 측별 **회신 건수** (사람 수가 아니다) */
  side: Record<Side, number>;
  /** 측별 참석 인원 합계 (SIS-38). headcount 와 같은 이유로 참석 회신만 센다 */
  sideHeadcount: Record<Side, number>;
}

/**
 * 목록을 집계한다. 순수 함수라 화면 없이도 검증된다.
 *
 * 식사 인원을 **참석 회신에서만** 세는 이유는 미참석 회신의 count 가 실제 인원이
 * 아니기 때문이다 — DB 의 count 가 not null 이라 1 로 채워 넣은 자리표시 값이다
 * (rsvp.ts 의 toRsvpPayload). 그대로 더하면 식수가 부풀어 그만큼 더 주문하게 된다.
 */
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
