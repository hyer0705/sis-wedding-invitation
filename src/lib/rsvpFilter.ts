import type { RsvpRow } from "./adminRsvp";
import type { Attend, Side } from "./rsvp";

export type AttendFilter = "전체" | Attend;

export type SideFilter = "양가" | Side;

export interface RsvpFilter {
  attend: AttendFilter;
  side: SideFilter;

  query: string;
}

export const EMPTY_FILTER: RsvpFilter = { attend: "전체", side: "양가", query: "" };

export function isFiltered(filter: RsvpFilter): boolean {
  return filter.attend !== "전체" || filter.side !== "양가" || filter.query.trim() !== "";
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function matchesQuery(row: RsvpRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  if (row.name.toLowerCase().includes(needle)) return true;

  const digits = digitsOnly(needle);
  return digits !== "" && digitsOnly(row.phone).includes(digits);
}

export function filterRsvp(rows: readonly RsvpRow[], filter: RsvpFilter): RsvpRow[] {
  return rows.filter((row) => {
    if (filter.attend !== "전체" && row.attend !== filter.attend) return false;
    if (filter.side !== "양가" && row.side !== filter.side) return false;
    return matchesQuery(row, filter.query);
  });
}

export function countByAttend(rows: readonly RsvpRow[]): Record<AttendFilter, number> {
  const counts: Record<AttendFilter, number> = { 전체: rows.length, 참석: 0, 미참석: 0 };
  for (const row of rows) counts[row.attend] += 1;
  return counts;
}

export function countBySide(rows: readonly RsvpRow[]): Record<SideFilter, number> {
  const counts: Record<SideFilter, number> = { 양가: rows.length, 신랑측: 0, 신부측: 0 };
  for (const row of rows) counts[row.side] += 1;
  return counts;
}
