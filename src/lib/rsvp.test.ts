import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  alreadySubmitted,
  buildRsvpPayload,
  isPastDeadline,
  normalizePhone,
  submitRsvp,
  EMPTY_FORM,
  MEAL_OPTIONS,
  type RsvpForm,
  type RsvpPayload,
} from "./rsvp";
import { getSupabase } from "./supabase";

vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));

describe("alreadySubmitted", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("제출 기록이 없으면 false를 반환한다", () => {
    expect(alreadySubmitted()).toBe(false);
  });

  it("제출 기록이 있으면 true를 반환한다", () => {
    localStorage.setItem("rsvp-submitted", "1");
    expect(alreadySubmitted()).toBe(true);
  });
});

describe("MEAL_OPTIONS", () => {
  it("화면 라벨과 저장값이 같다", () => {
    for (const option of MEAL_OPTIONS) {
      expect(option.label).toBe(option.value);
    }
  });
});

describe("normalizePhone", () => {
  it("하이픈과 공백을 걷어내고 숫자만 남긴다", () => {
    expect(normalizePhone("000-0000-0000")).toBe("00000000000");
    expect(normalizePhone(" 000 0000 0000 ")).toBe("00000000000");
    expect(normalizePhone("(02)000-0000")).toBe("020000000");
  });

  it("숫자가 아닌 문자는 전부 버린다", () => {
    expect(normalizePhone("000.0000.0000")).toBe("00000000000");
    expect(normalizePhone("공일공")).toBe("");
  });

  describe("국가번호", () => {
    it("+82 를 국내 표기로 되돌린다", () => {
      expect(normalizePhone("+82 00-0000-0000")).toBe("00000000000");
      expect(normalizePhone("+820000000000")).toBe("00000000000");
    });

    it("0082 로 적어도 되돌린다", () => {
      expect(normalizePhone("0082 00-0000-0000")).toBe("00000000000");
    });

    it("국가번호 표시가 없으면 건드리지 않는다", () => {
      expect(normalizePhone("820000000000")).toBe("820000000000");
    });
  });
});

describe("isPastDeadline", () => {
  const deadline = "2027-01-23";
  const at = (iso: string) => new Date(iso).getTime();

  it("마감일 당일 23시 59분에는 아직 마감이 아니다", () => {
    expect(isPastDeadline(deadline, at("2027-01-23T23:59:59+09:00"))).toBe(false);
  });

  it("마감 다음 날 0시 정각부터 마감이다", () => {
    expect(isPastDeadline(deadline, at("2027-01-24T00:00:00+09:00"))).toBe(true);
  });

  it("한참 이전이면 마감이 아니다", () => {
    expect(isPastDeadline(deadline, at("2026-08-18T12:00:00+09:00"))).toBe(false);
  });
});

describe("buildRsvpPayload", () => {
  const attending: RsvpForm = {
    side: "신랑측",
    attend: "참석",
    name: "홍길동",
    count: "2",
    meal: "식사함",
    phone: "000-0000-0000",
    agreed: true,
  };

  it("정상 입력이면 스키마에 맞는 페이로드를 만든다", () => {
    const result = buildRsvpPayload(attending);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({
      side: "신랑측",
      attend: "참석",
      name: "홍길동",
      count: 2,
      meal: "식사함",
      phone: "00000000000",
    });
  });

  it("빈 폼이면 필수 항목을 모두 지적한다", () => {
    const result = buildRsvpPayload(EMPTY_FORM);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["agreed", "attend", "meal", "name", "phone", "side"].sort());
  });

  it("동의하지 않으면 페이로드를 만들지 않는다", () => {
    const result = buildRsvpPayload({ ...attending, agreed: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.agreed).toBeTruthy();
  });

  it("이름 앞뒤 공백은 걷어낸다", () => {
    const result = buildRsvpPayload({ ...attending, name: "  홍길동  " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.name).toBe("홍길동");
  });

  it("공백뿐인 이름은 미입력으로 본다", () => {
    const result = buildRsvpPayload({ ...attending, name: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
  });

  it("이름이 20자를 넘으면 거부한다", () => {
    const result = buildRsvpPayload({ ...attending, name: "가".repeat(21) });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
  });

  describe("참석 인원", () => {
    it("1 미만이면 거부한다", () => {
      const result = buildRsvpPayload({ ...attending, count: "0" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.count).toBeTruthy();
    });

    it("20을 넘으면 거부한다", () => {
      const result = buildRsvpPayload({ ...attending, count: "21" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.count).toBeTruthy();
    });

    it("숫자가 아니면 거부한다", () => {
      const result = buildRsvpPayload({ ...attending, count: "두 명" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.count).toBeTruthy();
    });

    it("참석인데 비어 있으면 거부한다", () => {
      const result = buildRsvpPayload({ ...attending, count: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.count).toBeTruthy();
    });
  });

  describe("미참석 회신", () => {
    const absent: RsvpForm = { ...attending, attend: "미참석", count: "", phone: "000-0000-0000", meal: "미정" };

    it("연락처가 없으면 거부한다", () => {
      const result = buildRsvpPayload({ ...absent, phone: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.phone).toBeTruthy();
    });

    it("인원을 묻지 않으므로 count 는 1 로 채운다", () => {
      const result = buildRsvpPayload(absent);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.count).toBe(1);
    });

    it("적은 연락처를 숫자만 남겨 싣는다", () => {
      const result = buildRsvpPayload(absent);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.phone).toBe("00000000000");
    });

    it("자릿수가 틀리면 거부한다", () => {
      const result = buildRsvpPayload({ ...absent, phone: "000-00" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.phone).toBeTruthy();
    });

    it("공백만 적은 것은 적지 않은 것으로 본다", () => {
      const result = buildRsvpPayload({ ...absent, phone: "   " });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.phone).toBeTruthy();
    });

    it("숫자가 하나도 없는 입력은 조용히 버리지 않고 지적한다", () => {
      const result = buildRsvpPayload({ ...absent, phone: "몰라요" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.phone).toBeTruthy();
    });
  });

  describe("참석 시 연락처", () => {
    it("비어 있으면 거부한다", () => {
      const result = buildRsvpPayload({ ...attending, phone: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.phone).toBeTruthy();
    });

    it("9자리 미만이면 거부한다", () => {
      const result = buildRsvpPayload({ ...attending, phone: "000-0000" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.phone).toBeTruthy();
    });

    it("13자리를 넘으면 거부한다", () => {
      const result = buildRsvpPayload({ ...attending, phone: "00000000000000" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.phone).toBeTruthy();
    });

    it("하이픈 없이 입력해도 통과한다", () => {
      const result = buildRsvpPayload({ ...attending, phone: "00000000000" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.phone).toBe("00000000000");
    });
  });
});

describe("submitRsvp", () => {
  const payload: RsvpPayload = {
    side: "신랑측",
    attend: "참석",
    name: "홍길동",
    count: 2,
    meal: "식사함",
    phone: "00000000000",
  };

  type DbError = { code: string; message: string; details: string; hint: string };

  let insert: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  function respond(error: DbError | null) {
    insert = vi.fn(() => Promise.resolve({ error }));
    from = vi.fn(() => ({ insert }));
    vi.mocked(getSupabase).mockReturnValue({ from } as never);
  }

  const dbError = (code: string, message: string, details = ""): DbError => ({ code, message, details, hint: "" });

  it("rsvp 테이블에 페이로드를 그대로 넣는다", async () => {
    respond(null);

    await expect(submitRsvp(payload)).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith("rsvp");
    expect(insert).toHaveBeenCalledWith(payload);
  });

  it("오류가 돌아오면 던진다", async () => {
    respond(dbError("23514", 'new row violates check constraint "rsvp_phone_format"'));

    await expect(submitRsvp(payload)).rejects.toThrow(/23514/);
  });

  it("코드가 비어 있어도 던진다", async () => {
    respond(dbError("", "FetchError: Failed to fetch"));

    await expect(submitRsvp(payload)).rejects.toThrow(/unknown/);
  });

  it("오류 메시지에 회신 내용을 옮기지 않는다", async () => {
    respond(
      dbError(
        "23514",
        'new row for relation "rsvp" violates check constraint "rsvp_phone_format"',
        "Failing row contains (홍길동, 00000000000).",
      ),
    );

    const thrown = await submitRsvp(payload).then(
      () => null,
      (error: unknown) => error as Error,
    );

    expect(thrown).not.toBeNull();
    expect(thrown?.message).not.toContain("홍길동");
    expect(thrown?.message).not.toContain("00000000000");
    expect(thrown?.message).toContain("rsvp_phone_format");
  });
});
