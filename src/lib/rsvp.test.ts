import { beforeEach, describe, expect, it } from "vitest";
import { alreadySubmitted, buildRsvpPayload, isPastDeadline, normalizePhone, EMPTY_FORM, type RsvpForm } from "./rsvp";

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

describe("normalizePhone", () => {
  // DB 제약은 `^[0-9-]{9,13}$` 지만 저장값은 숫자만으로 통일한다. 하이픈 유무가
  // 섞여 들어오면 같은 사람의 번호가 두 모양으로 남아 대조가 안 된다.
  it("하이픈과 공백을 걷어내고 숫자만 남긴다", () => {
    expect(normalizePhone("000-0000-0000")).toBe("00000000000");
    expect(normalizePhone(" 000 0000 0000 ")).toBe("00000000000");
    expect(normalizePhone("(02)000-0000")).toBe("020000000");
  });

  it("숫자가 아닌 문자는 전부 버린다", () => {
    expect(normalizePhone("000.0000.0000")).toBe("00000000000");
    expect(normalizePhone("공일공")).toBe("");
  });

  // 국가번호를 붙여 적으면 숫자만 남겼을 때 82… 가 되는데, 길이가 맞아 검증도 통과해
  // 그대로 저장된다. 그 번호로 걸면 닿지 않고 저장된 값만 봐서는 원인도 알 수 없다.
  describe("국가번호", () => {
    // 국번 자리도 예시 관례대로 같은 숫자로 적는다. 진짜 형식으로 적으면 검토 게이트가
    // 개인정보로 보고 커밋을 막는다.
    it("+82 를 국내 표기로 되돌린다", () => {
      expect(normalizePhone("+82 00-0000-0000")).toBe("00000000000");
      expect(normalizePhone("+820000000000")).toBe("00000000000");
    });

    it("0082 로 적어도 되돌린다", () => {
      expect(normalizePhone("0082 00-0000-0000")).toBe("00000000000");
    });

    it("국가번호 표시가 없으면 건드리지 않는다", () => {
      // 앞에 + 나 00 이 없으면 국가번호라고 단정할 수 없다. 멀쩡한 입력을 고치지 않는다.
      expect(normalizePhone("820000000000")).toBe("820000000000");
    });
  });
});

describe("isPastDeadline", () => {
  const deadline = "2027-01-23";
  const at = (iso: string) => new Date(iso).getTime();

  // 마감일 당일 23:59:59(KST)까지는 받는다. DB 정책도 같은 경계를 본다 —
  // supabase/schema.sql 의 `now() < '2027-01-24T00:00:00+09:00'`.
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
  /** 참석 회신의 정상 입력. 각 테스트가 필요한 항목만 덮어쓴다. */
  const attending: RsvpForm = {
    side: "신랑측",
    attend: "참석",
    name: "홍길동",
    count: "2",
    meal: "식사",
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
      meal: "식사",
      phone: "00000000000",
    });
  });

  it("빈 폼이면 필수 항목을 모두 지적한다", () => {
    const result = buildRsvpPayload(EMPTY_FORM);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["agreed", "attend", "meal", "name", "side"].sort());
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
    // DB 의 char_length(name) between 1 and 20 과 같은 경계다.
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
    // 못 간다고 알려주려는 하객을 연락처에서 막으면 회신 자체를 포기한다.
    const absent: RsvpForm = { ...attending, attend: "미참석", count: "", phone: "", meal: "미정" };

    it("연락처가 없어도 통과하고 phone 은 null 이 된다", () => {
      const result = buildRsvpPayload(absent);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.phone).toBeNull();
    });

    it("인원을 묻지 않으므로 count 는 1 로 채운다", () => {
      // DB 의 count 는 not null 이고 1 이상이어야 한다. 집계는 attend 로 거르므로
      // 이 값이 미참석 인원으로 새지 않는다.
      const result = buildRsvpPayload(absent);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.count).toBe(1);
    });
  });

  describe("참석 시 연락처", () => {
    // 폼 검증이 DB 제약(rsvp_phone_required_for_attendees)보다 느슨하면 참석
    // 회신만 23514 로 거부되는데, 화면에서는 원인이 보이지 않는다.
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
