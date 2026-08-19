// SIS-38 — 관리자 목록의 필터. AD-01 · RS-04.
//
// **거르는 일은 전부 브라우저에서 한다.** 목록은 이미 listRsvp() 가 통째로 들고
// 있고(adminRsvp.ts), 집계도 그 전체를 받아야 나온다. 서버에 조건을 걸어 다시
// 받아 올 이유가 없다.
//
// 필터는 **목록만 좁힌다.** 집계와 CSV 는 늘 전체를 본다 — 거른 상태로 내려받은
// 파일을 전체로 착각하면 식수를 잘못 주문한다.
import type { RsvpRow } from "./adminRsvp";
import type { Attend, Side } from "./rsvp";

/** 참석 여부 필터. 「전체」는 거르지 않는다. */
export type AttendFilter = "전체" | Attend;
/** 양가 필터. 「양가」는 거르지 않는다. */
export type SideFilter = "양가" | Side;

export interface RsvpFilter {
  attend: AttendFilter;
  side: SideFilter;
  /** 이름·연락처 검색어. 공백만 있으면 거르지 않는다 */
  query: string;
}

export const EMPTY_FILTER: RsvpFilter = { attend: "전체", side: "양가", query: "" };

/** 거르는 조건이 하나라도 걸려 있는지. 「필터 해제」를 보일지 정하는 데 쓴다. */
export function isFiltered(filter: RsvpFilter): boolean {
  return filter.attend !== "전체" || filter.side !== "양가" || filter.query.trim() !== "";
}

/**
 * 연락처 검색을 위해 숫자만 남긴다.
 *
 * 저장값은 숫자만이지만(rsvp.ts 의 normalizePhone) **화면에는 하이픈이 붙은 채로
 * 보인다**(csv.ts 의 formatPhone). 보이는 대로 `010-1234` 라고 적어 넣었을 때
 * 한 건도 걸리지 않으면 검색이 고장 난 것으로 보이므로, 양쪽에서 하이픈을 걷고
 * 맞춘다.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * 한 건이 검색어에 걸리는지.
 *
 * 이름은 적은 그대로(대소문자만 무시), 연락처는 숫자만 뽑아 비교한다. 검색어에
 * 숫자가 없으면 연락처는 보지 않는다 — 이름에 든 숫자를 번호로 오해할 일은 없지만,
 * 반대로 `1` 한 글자에 번호가 든 회신이 모두 걸려 나오면 쓸모가 없다.
 */
function matchesQuery(row: RsvpRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  if (row.name.toLowerCase().includes(needle)) return true;

  const digits = digitsOnly(needle);
  return digits !== "" && digitsOnly(row.phone).includes(digits);
}

/** 목록을 필터에 맞게 거른다. 원본 순서(최신순)를 그대로 둔다. */
export function filterRsvp(rows: readonly RsvpRow[], filter: RsvpFilter): RsvpRow[] {
  return rows.filter((row) => {
    if (filter.attend !== "전체" && row.attend !== filter.attend) return false;
    if (filter.side !== "양가" && row.side !== filter.side) return false;
    return matchesQuery(row, filter.query);
  });
}

/** 세그먼트 버튼에 붙일 건수. 「전체 42 · 참석 31 · 미참석 11」의 그 숫자다. */
export function countByAttend(rows: readonly RsvpRow[]): Record<AttendFilter, number> {
  const counts: Record<AttendFilter, number> = { 전체: rows.length, 참석: 0, 미참석: 0 };
  for (const row of rows) counts[row.attend] += 1;
  return counts;
}

/** 같은 용도의 양가 건수. */
export function countBySide(rows: readonly RsvpRow[]): Record<SideFilter, number> {
  const counts: Record<SideFilter, number> = { 양가: rows.length, 신랑측: 0, 신부측: 0 };
  for (const row of rows) counts[row.side] += 1;
  return counts;
}
