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
//   meal    '식사' | '식사안함' | '미정'
//   phone   숫자·하이픈 9~13자 + attend = '미참석' or phone is not null
//
// 규칙은 zod 스키마 하나(rsvpSchema)에만 적는다. 화면(react-hook-form)과 테스트가
// 같은 스키마를 보므로, 폼에서만 통과하고 검증에서는 막히는 어긋남이 생기지 않는다.
// 방명록(SIS-21)도 같은 방식으로 스키마를 세운다.
import { z } from "zod";
import { INVITE } from "../invite";

const DAY_MS = 86_400_000;

export const SIDES = ["신랑측", "신부측"] as const;
export const ATTENDS = ["참석", "미참석"] as const;
export const MEALS = ["식사", "식사안함", "미정"] as const;

export type Side = (typeof SIDES)[number];
export type Attend = (typeof ATTENDS)[number];
export type Meal = (typeof MEALS)[number];

/** 화면 라벨과 저장값의 대응. 저장값은 DB check 제약이 고정하므로 라벨만 바꾼다. */
export const SIDE_OPTIONS = [
  { value: "신랑측", label: "신랑측 하객" },
  { value: "신부측", label: "신부측 하객" },
] as const satisfies readonly { value: Side; label: string }[];

export const ATTEND_OPTIONS = [
  { value: "참석", label: "참석합니다" },
  { value: "미참석", label: "참석 어려워요" },
] as const satisfies readonly { value: Attend; label: string }[];

// 3택 확정(2026-08-18, B안). 세 버튼이 375px 한 줄에 들어가야 해 라벨을 짧게 잡았다.
export const MEAL_OPTIONS = [
  { value: "식사", label: "식사합니다" },
  { value: "식사안함", label: "안 합니다" },
  { value: "미정", label: "미정" },
] as const satisfies readonly { value: Meal; label: string }[];

/** DB 로 나가는 값. 컬럼 이름·타입이 supabase/schema.sql 과 1:1 이다. */
export interface RsvpPayload {
  side: Side;
  attend: Attend;
  name: string;
  count: number;
  meal: Meal;
  /** 미참석 회신은 받지 않으므로 null 이다. */
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
 * 조건부 규칙(참석일 때만 인원·연락처를 묻는다)은 superRefine 으로 둔다. 미참석
 * 회신에서 두 칸은 화면에 아예 없으므로 비어 있는 것이 정상이고, 이를 오류로 잡으면
 * 회신 자체가 막힌다.
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
    if (data.attend !== "참석") return;

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

    // 폼 검증이 DB 제약(rsvp_phone_required_for_attendees)보다 느슨하면 참석 회신만
    // 23514 로 거부되는데, 화면에서는 원인이 보이지 않는다.
    const digits = normalizePhone(data.phone);
    if (!digits) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "연락처를 입력해 주세요" });
    } else if (digits.length < PHONE_MIN || digits.length > PHONE_MAX) {
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
 * 미참석 회신은 인원과 연락처를 묻지 않으므로 여기서 채운다. count 를 1 로 두는 것은
 * DB 의 count 가 not null 이고 1 이상이어야 하기 때문이며, 집계는 attend 로 거르므로
 * 이 값이 미참석 인원으로 새지 않는다.
 */
export function toRsvpPayload(values: RsvpValues): RsvpPayload {
  const attending = values.attend === "참석";

  return {
    side: values.side,
    attend: values.attend,
    name: values.name,
    count: attending ? Number(values.count) : 1,
    meal: values.meal,
    phone: attending ? normalizePhone(values.phone) : null,
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

/**
 * 전송이 아직 연결되지 않았다는 표식.
 *
 * **`scripts/verify-release.mjs` 가 이 이름을 찾아 배포를 막는다.** 미연결 상태는
 * 화면에 전혀 드러나지 않는 종류의 미완성이다 — 폼은 멀쩡히 그려지고 제출만 매번
 * 실패하므로, 하객은 자기 문제로 여기고 고객은 회신이 0건인 이유를 알 수 없다.
 * `.todo` 자리표시와 달리 눈으로는 잡히지 않아 게이트가 대신 본다.
 *
 * SIS-20 은 이 상수와 아래 throw 를 통째로 지우고 insert 를 넣는다.
 */
export const RSVP_NOT_WIRED = "RSVP 전송이 아직 연결되지 않았습니다 (SIS-20)";

/**
 * 회신을 Supabase 로 보낸다.
 *
 * ⚠ 아직 연결되지 않았다 — 전송은 SIS-20 의 범위이며, 이 함수의 몸통만
 * `getSupabase().from("rsvp").insert(payload)` 로 갈아끼우면 된다. 시그니처는
 * 그때 바뀌지 않도록 지금 모양으로 고정해 두었다.
 *
 * 조용히 성공한 척하지 않는 것이 중요하다. 백엔드를 Supabase 로 옮긴 이유가
 * 바로 Apps Script 의 `no-cors` 가 실패를 삼켜 회신 유실을 알 수 없다는 것이었다
 * (SIS-33). 연결 전에는 반드시 던진다.
 */
export async function submitRsvp(payload: RsvpPayload): Promise<void> {
  void payload; // SIS-20 이 이 줄을 지우고 insert 를 넣는다
  throw new Error(RSVP_NOT_WIRED);
}
