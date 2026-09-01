import type { RsvpRow } from "./adminRsvp";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const HEADERS = ["제출시각", "신랑·신부측", "참석여부", "이름", "인원", "식사", "연락처"] as const;

export function formatPhone(digits: string): string {
  if (!/^\d+$/.test(digits)) return digits;

  if (digits.startsWith("02")) {
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return digits;
  }
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

export function formatKst(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;

  const kst = new Date(ms + KST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ` +
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`
  );
}

const FORMULA_LEAD = /^[=+\-@\t\r]/;

function cell(value: string | number): string {
  const raw = String(value);
  const text = FORMULA_LEAD.test(raw) ? `'${raw}` : raw;

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toRsvpCsv(rows: readonly RsvpRow[]): string {
  const lines = [HEADERS.join(",")];

  for (const row of rows) {
    const attending = row.attend === "참석";
    lines.push(
      [
        cell(formatKst(row.created_at)),
        cell(row.side),
        cell(row.attend),
        cell(row.name),
        cell(attending ? row.count : ""),
        cell(attending ? row.meal : ""),
        cell(formatPhone(row.phone)),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

export function rsvpCsvBlob(rows: readonly RsvpRow[]): Blob {
  return new Blob(["\uFEFF", toRsvpCsv(rows)], { type: "text/csv;charset=utf-8" });
}

export function rsvpCsvFileName(now: number = Date.now()): string {
  return `rsvp-${formatKst(new Date(now).toISOString()).slice(0, 10)}.csv`;
}
