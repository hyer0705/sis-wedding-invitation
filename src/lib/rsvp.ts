import { z } from "zod";
import { INVITE } from "../invite";
import { getSupabase } from "./supabase";

const DAY_MS = 86_400_000;

export const SIDES = ["신랑측", "신부측"] as const;
export const ATTENDS = ["참석", "미참석"] as const;
export const MEALS = ["식사함", "식사안함", "미정"] as const;

export type Side = (typeof SIDES)[number];
export type Attend = (typeof ATTENDS)[number];
export type Meal = (typeof MEALS)[number];

export const SIDE_OPTIONS = [
  { value: "신랑측", label: "신랑측 하객" },
  { value: "신부측", label: "신부측 하객" },
] as const satisfies readonly { value: Side; label: string }[];

export const ATTEND_OPTIONS = [
  { value: "참석", label: "참석합니다" },
  { value: "미참석", label: "참석 어려워요" },
] as const satisfies readonly { value: Attend; label: string }[];

export const MEAL_OPTIONS = [
  { value: "식사함", label: "식사함" },
  { value: "식사안함", label: "식사안함" },
  { value: "미정", label: "미정" },
] as const satisfies readonly { value: Meal; label: string }[];

export interface RsvpPayload {
  side: Side;
  attend: Attend;
  name: string;
  count: number;
  meal: Meal;
  phone: string;
}

const STORAGE_KEY = "rsvp-submitted";

const NAME_MAX = 20;
const COUNT_MIN = 1;
const COUNT_MAX = 20;
const PHONE_MIN = 9;
const PHONE_MAX = 13;

function pick<T extends string>(values: readonly T[], message: string) {
  return z.string().refine((value): value is T => (values as readonly string[]).includes(value), { error: message });
}

export const rsvpSchema = z
  .object({
    side: pick(SIDES, "신랑측·신부측을 선택해 주세요"),
    attend: pick(ATTENDS, "참석 여부를 선택해 주세요"),
    name: z
      .string()
      .trim()
      .min(1, { error: "성함을 입력해 주세요" })
      .max(NAME_MAX, { error: `성함은 ${NAME_MAX}자까지 입력할 수 있어요` }),
    count: z.string(),
    meal: pick(MEALS, "식사 여부를 선택해 주세요"),
    phone: z.string(),
    agreed: z.boolean().refine((value) => value, { error: "개인정보 수집·이용에 동의해 주세요" }),
  })
  .superRefine((data, ctx) => {
    const attending = data.attend === "참석";

    if (attending) {
      const count = data.count.trim();
      if (!/^\d+$/.test(count)) {
        ctx.addIssue({ code: "custom", path: ["count"], message: "참석 인원을 숫자로 입력해 주세요" });
      } else if (Number(count) < COUNT_MIN || Number(count) > COUNT_MAX) {
        ctx.addIssue({
          code: "custom",
          path: ["count"],
          message: `참석 인원은 ${COUNT_MIN}~${COUNT_MAX}명까지 입력할 수 있어요`,
        });
      }
    }

    const typed = data.phone.trim() !== "";
    const digits = normalizePhone(data.phone);

    if (!digits) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: typed ? "연락처를 다시 확인해 주세요" : "연락처를 입력해 주세요",
      });
      return;
    }

    if (digits.length < PHONE_MIN || digits.length > PHONE_MAX) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "연락처를 다시 확인해 주세요" });
    }
  });

export type RsvpForm = z.input<typeof rsvpSchema>;
export type RsvpValues = z.output<typeof rsvpSchema>;

export type RsvpField = keyof RsvpForm;
export type RsvpErrors = Partial<Record<RsvpField, string>>;

export type RsvpValidation = { ok: true; payload: RsvpPayload } | { ok: false; errors: RsvpErrors };

export const EMPTY_FORM: RsvpForm = {
  side: "",
  attend: "",
  name: "",
  count: "",
  meal: "",
  phone: "",
  agreed: false,
};

export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!/^(?:\+|00)/.test(trimmed)) return digits;

  const korean = /^(?:00)?82(\d+)$/.exec(digits);
  return korean ? `0${korean[1]}` : digits;
}

export function isPastDeadline(deadline: string, now: number): boolean {
  return now >= new Date(`${deadline}T00:00:00+09:00`).getTime() + DAY_MS;
}

export function toRsvpPayload(values: RsvpValues): RsvpPayload {
  const attending = values.attend === "참석";
  const phone = normalizePhone(values.phone);

  return {
    side: values.side,
    attend: values.attend,
    name: values.name,
    count: attending ? Number(values.count) : 1,
    meal: values.meal,
    phone,
  };
}

export function confirmRows(payload: RsvpPayload): { label: string; value: string }[] {
  const attending = payload.attend === "참석";

  return [
    { label: "하객 구분", value: payload.side },
    { label: "참석 여부", value: payload.attend },
    { label: "성함", value: payload.name },
    ...(attending ? [{ label: "참석 인원", value: `${payload.count}명` }] : []),
    { label: "연락처", value: payload.phone },
    ...(attending ? [{ label: "식사 여부", value: payload.meal }] : []),
  ];
}

export function buildRsvpPayload(form: RsvpForm): RsvpValidation {
  const result = rsvpSchema.safeParse(form);
  if (result.success) return { ok: true, payload: toRsvpPayload(result.data) };

  const errors: RsvpErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as RsvpField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

export function alreadySubmitted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSubmitted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

export function isRsvpClosed(now: number = Date.now()): boolean {
  return isPastDeadline(INVITE.rsvp.deadline, now);
}

const TABLE = "rsvp";

export async function submitRsvp(payload: RsvpPayload): Promise<void> {
  const { error } = await getSupabase().from(TABLE).insert(payload);
  if (!error) return;

  throw new Error(`회신 저장 실패 (${error.code || "unknown"}): ${error.message}`);
}
