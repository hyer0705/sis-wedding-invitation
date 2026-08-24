import { getAdminSupabase } from "./supabase";
import type { GuestbookEntry } from "./guestbook";

const TABLE = "guestbook";
const READABLE_COLUMNS = "id, name, message, created_at";

interface GuestbookRow {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

function toEntry(row: GuestbookRow): GuestbookEntry {
  return { id: row.id, name: row.name, message: row.message, createdAt: row.created_at };
}

export async function listGuestbook(): Promise<GuestbookEntry[]> {
  const { data, error } = await getAdminSupabase()
    .from(TABLE)
    .select(READABLE_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(`방명록 조회 실패 (${error.code || "unknown"}): ${error.message}`);
  return ((data ?? []) as GuestbookRow[]).map(toEntry);
}

export async function deleteGuestbookAsAdmin(id: string): Promise<void> {
  const { data, error } = await getAdminSupabase().from(TABLE).delete().eq("id", id).select("id");

  if (error) throw new Error(`방명록 삭제 실패 (${error.code || "unknown"}): ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("방명록 삭제 실패: 지워진 행이 없습니다 — 권한이 없거나 이미 지워진 메시지입니다");
  }
}

export function filterGuestbook(entries: readonly GuestbookEntry[], query: string): GuestbookEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...entries];

  return entries.filter((entry) => entry.name.toLowerCase().includes(needle) || entry.message.toLowerCase().includes(needle));
}
