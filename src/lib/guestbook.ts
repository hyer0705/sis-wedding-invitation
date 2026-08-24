import { z } from "zod";
import { getSupabase } from "./supabase";

export const NAME_MAX = 20;
export const MESSAGE_MAX = 300;
export const PASSWORD_MIN = 4;

export const MAIN_VISIBLE_COUNT = 5;
export const PAGE_SIZE = 10;

export const guestbookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "성함을 입력해 주세요" })
    .max(NAME_MAX, { error: `성함은 ${NAME_MAX}자까지 입력할 수 있어요` }),
  message: z
    .string()
    .trim()
    .min(1, { error: "축하 메시지를 입력해 주세요" })
    .max(MESSAGE_MAX, { error: `메시지는 ${MESSAGE_MAX}자까지 입력할 수 있어요` }),
  password: z.string().min(PASSWORD_MIN, { error: `비밀번호는 ${PASSWORD_MIN}자 이상으로 정해 주세요` }),
});

export type GuestbookForm = z.input<typeof guestbookSchema>;
export type GuestbookValues = z.output<typeof guestbookSchema>;
export type GuestbookField = keyof GuestbookForm;
export type GuestbookErrors = Partial<Record<GuestbookField, string>>;
export type GuestbookValidation = { ok: true; values: GuestbookValues } | { ok: false; errors: GuestbookErrors };

export const EMPTY_GUESTBOOK_FORM: GuestbookForm = { name: "", message: "", password: "" };

export function validateGuestbookForm(form: GuestbookForm): GuestbookValidation {
  const result = guestbookSchema.safeParse(form);
  if (result.success) return { ok: true, values: result.data };

  const errors: GuestbookErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as GuestbookField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

export function passwordError(password: string): string | null {
  return password.length >= PASSWORD_MIN ? null : `비밀번호는 ${PASSWORD_MIN}자 이상이에요`;
}

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

export interface GuestbookPage {
  entries: GuestbookEntry[];
  nextCursor: string | null;
}

export interface GuestbookPreview {
  entries: GuestbookEntry[];
  hasMore: boolean;
}

interface GuestbookRow {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

const TABLE = "guestbook";
const READABLE_COLUMNS = "id, name, message, created_at";
const CREATE_FUNCTION = "create_guestbook_entry";
const DELETE_FUNCTION = "delete_guestbook_entry";

function toEntry(row: GuestbookRow): GuestbookEntry {
  return { id: row.id, name: row.name, message: row.message, createdAt: row.created_at };
}

function failed(action: string, error: { code?: string; message: string }): Error {
  return new Error(`${action} 실패 (${error.code || "unknown"}): ${error.message}`);
}

export async function fetchGuestbookPage(cursor: string | null = null, size: number = PAGE_SIZE): Promise<GuestbookPage> {
  let query = getSupabase()
    .from(TABLE)
    .select(READABLE_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw failed("방명록 목록 조회", error);

  const rows = (data ?? []) as GuestbookRow[];
  const entries = rows.slice(0, size).map(toEntry);
  const last = entries[entries.length - 1];

  return { entries, nextCursor: rows.length > size && last ? last.createdAt : null };
}

export async function fetchGuestbookPreview(size: number = MAIN_VISIBLE_COUNT): Promise<GuestbookPreview> {
  const page = await fetchGuestbookPage(null, size);
  return { entries: page.entries, hasMore: page.nextCursor !== null };
}

export async function createGuestbookEntry(values: GuestbookValues): Promise<string> {
  const { data, error } = await getSupabase().rpc(CREATE_FUNCTION, {
    entry_name: values.name,
    entry_message: values.message,
    entry_password: values.password,
  });
  if (error) throw failed("축하 메시지 저장", error);

  return data as string;
}

export async function deleteGuestbookEntry(id: string, password: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc(DELETE_FUNCTION, { entry_id: id, entry_password: password });
  if (error) throw failed("축하 메시지 삭제", error);

  return data === true;
}
