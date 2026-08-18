// RS-01 참석 여부 회신의 검증·페이로드 생성. 폼(SIS-15)과 전송(SIS-20)이 함께 쓴다.
//
// 검증을 컴포넌트가 아니라 여기 두는 이유는 이 규칙이 **DB 제약과 한 짝**이기
// 때문이다. supabase/schema.sql 의 check 제약이 같은 조건을 한 번 더 보는데, 폼이
// 더 느슨하면 그 회신만 23514 로 거부된다 — 화면에는 원인이 보이지 않고, 하객은
// 왜 안 되는지 알 수 없다. 그래서 두 곳의 경계를 테스트로 고정해 둔다.
//
// 대응 관계:
//   name    char_length 1~20
//   count   1~20 (not null — 미참석 회신은 1 로 채운다)
//   meal    '식사함' | '식사안함' | '미정'
//   phone   숫자·하이픈 9~13자 + attend = '미참석' or phone is not null
//
// 규칙은 zod 스키마 하나(rsvpSchema)에만 적는다. 화면(react-hook-form)과 테스트가
// 같은 스키마를 보므로, 폼에서만 통과하고 검증에서는 막히는 어긋남이 생기지 않는다.
// 방명록(SIS-21)도 같은 방식으로 스키마를 세운다.
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

/**
 * 화면 라벨과 저장값의 대응. 저장값은 DB check 제약이 고정하므로 라벨만 바꾼다.
 *
 * 식사 여부만은 예외로 **둘을 같은 값으로 맞춰 두었다**(SIS-35) — 아래 MEAL_OPTIONS.
 */
export const SIDE_OPTIONS = [
  { value: "신랑측", label: "신랑측 하객" },
  { value: "신부측", label: "신부측 하객" },
] as const satisfies readonly { value: Side; label: string }[];

export const ATTEND_OPTIONS = [
  { value: "참석", label: "참석합니다" },
  { value: "미참석", label: "참석 어려워요" },
] as const satisfies readonly { value: Attend; label: string }[];

// 3택 확정(2026-08-18, B안). 세 버튼이 375px 한 줄에 들어가야 해 라벨을 짧게 잡았다.
//
// 라벨과 저장값이 같다. 일부러 그렇게 맞췄다(SIS-35) — 명세서 시트에는 화면에 보이는
// 문구가 적히는데, 그것이 저장값과 다르면 다음 사람이 시트를 보고 schema.sql 의 check
// 제약을 화면 문구로 고친다. 「시트가 유일한 기준」이므로 그 착각은 정상적인 판단이다.
// 그 순간 폼은 여전히 옛 값을 보내 **참석 회신만** 23514 로 거부되고, 화면에는 원인이
// 보이지 않는 「회신 전송에 실패했어요」만 뜬다. 두 값을 하나로 두면 어긋날 자리가 없다.
export const MEAL_OPTIONS = [
  { value: "식사함", label: "식사함" },
  { value: "식사안함", label: "식사안함" },
  { value: "미정", label: "미정" },
] as const satisfies readonly { value: Meal; label: string }[];

/** DB 로 나가는 값. 컬럼 이름·타입이 supabase/schema.sql 과 1:1 이다. */
export interface RsvpPayload {
  side: Side;
  attend: Attend;
  name: string;
  count: number;
  meal: Meal;
  /** 미참석 회신에서는 선택이므로, 적지 않으면 null 이다. */
  phone: string | null;
}

const STORAGE_KEY = "rsvp-submitted";

const NAME_MAX = 20;
const COUNT_MIN = 1;
const COUNT_MAX = 20;
const PHONE_MIN = 9;
const PHONE_MAX = 13;

/**
 * 선택 버튼 묶음을 검증한다.
 *
 * `z.enum` 을 그대로 쓰지 않는 이유는 폼의 초기값이 빈 문자열이기 때문이다. enum 은
 * "" 를 입력 타입에서부터 거부해 react-hook-form 의 defaultValues 와 타입이 어긋난다.
 * 문자열로 받아 좁히면 미선택 상태를 그대로 들고 있다가 검증에서 걸린다.
 */
function pick<T extends string>(values: readonly T[], message: string) {
  return z.string().refine((value): value is T => (values as readonly string[]).includes(value), { error: message });
}

/**
 * RS-01 회신 폼의 검증 규칙. **이 스키마가 유일한 기준이다.**
 *
 * 조건부 규칙(참석일 때만 인원을 묻는다)은 superRefine 으로 둔다. 미참석 회신에서
 * 인원 칸은 화면에 아예 없으므로 비어 있는 것이 정상이고, 이를 오류로 잡으면 회신
 * 자체가 막힌다.
 *
 * 연락처는 참석에서 필수, 미참석에서 선택이다(SIS-35). 선택이라고 검사까지 건너뛰지는
 * 않는다 — 적었는데 자릿수가 틀리면 그대로 저장되어 예식 전에 걸어도 닿지 않는다.
 */
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
    // 동의 없이는 수집 자체가 불가하다(RS-03). 화면은 제출 버튼을 잠가 여기까지
    // 오지 않게 하지만, 잠금이 풀린 채 배포되는 경우를 대비해 여기서도 막는다.
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

    // 적기는 했는지를 자릿수와 따로 본다. 「몰라요」·「-」처럼 숫자가 하나도 없는
    // 입력은 normalizePhone 을 거치면 빈 문자열이 되어 미입력과 구별되지 않는데,
    // 미참석에서 그것을 그냥 통과시키면 하객은 번호를 남겼다고 믿지만 저장되는 값은
    // null 이다 — 축의 대조·답례에 쓸 것이 남지 않는다.
    const typed = data.phone.trim() !== "";
    const digits = normalizePhone(data.phone);

    if (!digits) {
      // 미참석은 **비워 두는 것만** 허용한다(SIS-35). 참석은 다르다 — 폼 검증이 DB
      // 제약(rsvp_phone_required_for_attendees)보다 느슨하면 참석 회신만 23514 로
      // 거부되는데, 화면에서는 원인이 보이지 않는다.
      if (attending) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: "연락처를 입력해 주세요" });
      } else if (typed) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: "연락처를 다시 확인해 주세요" });
      }
      return;
    }

    // 적었다면 참석·미참석을 가리지 않고 자릿수를 본다. 선택 항목이라고 검사를 건너뛰면
    // 잘못 적힌 번호가 그대로 저장되고, 예식 전에 걸어도 닿지 않는다. DB 의
    // rsvp_phone_format 도 미참석 회신의 phone 을 똑같이 본다.
    if (digits.length < PHONE_MIN || digits.length > PHONE_MAX) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "연락처를 다시 확인해 주세요" });
    }
  });

/** 화면이 들고 있는 입력값. 전부 문자열·불리언이라 그대로 input 에 물릴 수 있다. */
export type RsvpForm = z.input<typeof rsvpSchema>;
/** 검증을 통과한 값. 선택지가 좁혀지고 이름은 앞뒤 공백이 걷혀 있다. */
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

/**
 * 연락처에서 숫자만 남긴다.
 *
 * DB 는 하이픈을 허용하지만(`^[0-9-]{9,13}$`) 저장값은 숫자만으로 통일한다. 하객이
 * 하이픈을 넣기도 빼기도 해서, 그대로 두면 같은 번호가 두 모양으로 쌓여 대조가
 * 안 된다. 괄호·점·공백 같은 구분자도 여기서 함께 걷어낸다.
 *
 * 국가번호를 붙여 적는 하객이 있다(`+82 10-…`, `0082-10-…`). 숫자만 남기면
 * 821012345678 이 되는데, 길이가 12 라 검증도 통과해 그대로 저장된다 — 예식 전에
 * 그 번호로 걸면 닿지 않고, 저장된 값만 봐서는 원래 010 번호였다는 것도 알 수 없다.
 * 그래서 한국 국가번호는 국내 표기로 되돌린다.
 *
 * 되돌리는 것은 **`+` 나 `00` 이 앞에 붙어 국가번호임이 분명할 때뿐이다.** 그 표시
 * 없이 82 로 시작하는 값까지 건드리면, 뜻하지 않게 멀쩡한 입력을 고치게 된다.
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!/^(?:\+|00)/.test(trimmed)) return digits;

  const korean = /^(?:00)?82(\d+)$/.exec(digits);
  return korean ? `0${korean[1]}` : digits;
}

/**
 * 응답 마감 여부. 마감일 당일까지 받고, 다음 날 0시(KST)부터 닫는다.
 *
 * DB 정책도 같은 경계를 본다 — supabase/schema.sql 의
 * `now() < '2027-01-24T00:00:00+09:00'`. 한국은 서머타임이 없어 하루를 더하는
 * 것만으로 다음 날 자정이 정확히 나온다.
 */
export function isPastDeadline(deadline: string, now: number): boolean {
  return now >= new Date(`${deadline}T00:00:00+09:00`).getTime() + DAY_MS;
}

/**
 * 검증을 통과한 값을 DB 페이로드로 옮긴다.
 *
 * 미참석 회신은 인원을 묻지 않으므로 여기서 채운다. count 를 1 로 두는 것은 DB 의
 * count 가 not null 이고 1 이상이어야 하기 때문이며, 집계는 attend 로 거르므로 이 값이
 * 미참석 인원으로 새지 않는다.
 *
 * 연락처는 attend 로 가르지 않고 **적혔는지로만** 가른다(SIS-35). 미참석에서도 받게
 * 되면서 attend 로 판단하면 방금 적어 넣은 번호를 도로 버리게 된다.
 */
export function toRsvpPayload(values: RsvpValues): RsvpPayload {
  const attending = values.attend === "참석";
  const phone = normalizePhone(values.phone);

  return {
    side: values.side,
    attend: values.attend,
    name: values.name,
    count: attending ? Number(values.count) : 1,
    meal: values.meal,
    // 빈 문자열이 아니라 null 로 보낸다. ''는 rsvp_phone_format 에 걸려 23514 가 되고,
    // 참석 회신이라면 rsvp_phone_required_for_attendees 를 빈 값으로 통과해 버린다.
    phone: phone || null,
  };
}

/**
 * 폼 입력을 검증해 페이로드를 만든다. 화면은 react-hook-form 이 같은 스키마로 검증하고,
 * 이 함수는 테스트와 스키마 밖에서 부르는 자리를 위한 얇은 껍데기다.
 */
export function buildRsvpPayload(form: RsvpForm): RsvpValidation {
  const result = rsvpSchema.safeParse(form);
  if (result.success) return { ok: true, payload: toRsvpPayload(result.data) };

  // 한 칸에 오류가 둘 이상이면 먼저 난 것만 보여준다. 같은 자리에 두 줄을 띄우면
  // 무엇을 고쳐야 하는지가 오히려 흐려진다.
  const errors: RsvpErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as RsvpField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** 이 브라우저에서 이미 회신했는지. 중복 제출을 막는 데 쓴다. */
export function alreadySubmitted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 제출 기록을 남긴다. 사생활 보호 모드 등에서 막혀도 제출 자체는 성공으로 둔다. */
export function markSubmitted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // 저장이 막힌 브라우저에서는 중복 제출을 막지 못한다. 회신이 두 번 들어오는
    // 것이 회신을 잃는 것보다 낫다.
  }
}

/** 마감일이 지났는지. 화면이 폼 대신 마감 안내를 보여줄지 판단한다. */
export function isRsvpClosed(now: number = Date.now()): boolean {
  return isPastDeadline(INVITE.rsvp.deadline, now);
}

/** 회신이 들어가는 테이블. supabase/schema.sql 의 이름과 같아야 한다. */
const TABLE = "rsvp";

/**
 * 회신을 Supabase 로 보낸다 (SIS-20).
 *
 * `insert` 뒤에 `select` 를 붙이지 않는다. anon 에는 select 정책이 없으므로(RLS)
 * 붙이는 순간 **저장은 됐는데 되읽기에서 막혀 실패로 보인다** — 하객은 다시
 * 제출하고 같은 회신이 두 번 쌓인다.
 *
 * supabase-js 는 DB 오류를 던지지 않고 `{ error }` 로 돌려준다. 네트워크 실패까지
 * 같은 모양으로 감싸 오므로 여기서 확인하지 않으면 무엇이 실패해도 성공으로
 * 지나가고, 완료 카드가 뜬 채 회신은 어디에도 남지 않는다 — Apps Script 를 버린
 * 이유(실패의 조용한 유실, SIS-33)가 그대로 재현된다. 그래서 반드시 던진다.
 *
 * 던진 오류는 화면에 그대로 나가지 않는다. 하객에게는 Rsvp.tsx 가 다시 시도해
 * 달라는 안내를 띄우고, 이 메시지는 원인을 좁히는 쪽에서 본다.
 */
export async function submitRsvp(payload: RsvpPayload): Promise<void> {
  const { error } = await getSupabase().from(TABLE).insert(payload);
  if (!error) return;

  // error.details 는 싣지 않는다. Postgres 는 제약 위반에 「Failing row contains
  // (…)」로 회신 내용을 통째로 실어 보내므로, 그대로 두면 하객의 이름과 연락처가
  // 콘솔에 남는다. 원인을 좁히는 데 필요한 것은 코드와 제약 이름뿐이다.
  //
  // 자주 보게 될 코드:
  //   23514 check 제약 위반 — 폼 검증이 schema.sql 보다 느슨해졌다는 뜻이다
  //   42501 RLS 거부 — 마감이 지났거나 insert 정책이 사라졌다
  //   PGRST204 테이블에 없는 컬럼 — schema.sql 의 alter table 이 적용되지 않았다
  throw new Error(`회신 저장 실패 (${error.code || "unknown"}): ${error.message}`);
}
