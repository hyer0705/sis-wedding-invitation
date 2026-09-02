import { describe, expect, it } from "vitest";
import { formatKst, formatPhone, rsvpCsvBlob, rsvpCsvFileName, toRsvpCsv } from "./csv";
import type { RsvpRow } from "./adminRsvp";

function row(overrides: Partial<RsvpRow> = {}): RsvpRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    side: "신랑측",
    attend: "참석",
    name: "홍길동",
    count: 2,
    meal: "식사함",
    phone: "01012345678",
    created_at: "2026-08-18T12:03:00.000Z",
    ...overrides,
  };
}

describe("formatPhone", () => {
  it("휴대폰 번호에 하이픈을 넣는다", () => {
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
  });

  it("서울 지역번호는 국번을 두 자리로 끊는다", () => {
    expect(formatPhone("0212345678")).toBe("02-1234-5678");
    expect(formatPhone("021234567")).toBe("02-123-4567");
  });

  it("10자리 지역번호를 끊는다", () => {
    expect(formatPhone("0311234567")).toBe("031-123-4567");
  });

  it("아는 형태가 아니면 원본을 그대로 둔다", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("010-1234-5678")).toBe("010-1234-5678");
  });
});

describe("formatKst", () => {
  it("UTC 시각을 KST 로 옮긴다", () => {
    expect(formatKst("2026-08-18T12:03:00.000Z")).toBe("2026-08-18 21:03");
  });

  it("자정을 넘기면 날짜도 함께 넘어간다", () => {
    expect(formatKst("2026-08-18T15:30:00.000Z")).toBe("2026-08-19 00:30");
  });

  it("읽을 수 없는 값은 원본을 그대로 둔다", () => {
    expect(formatKst("어제")).toBe("어제");
  });
});

describe("toRsvpCsv", () => {
  it("헤더를 고객이 지정한 순서로 적는다", () => {
    expect(toRsvpCsv([]).split("\r\n")[0]).toBe("제출시각,신랑·신부측,참석여부,이름,인원,식사,연락처");
  });

  it("회신 한 건을 한 줄로 적는다", () => {
    const [, line] = toRsvpCsv([row()]).split("\r\n");
    expect(line).toBe("2026-08-18 21:03,신랑측,참석,홍길동,2,식사함,010-1234-5678");
  });

  it("미참석 회신은 인원·식사를 비운다", () => {
    const [, line] = toRsvpCsv([row({ attend: "미참석", count: 1, meal: "식사안함" })]).split("\r\n");
    expect(line).toBe("2026-08-18 21:03,신랑측,미참석,홍길동,,,010-1234-5678");
  });

  it("쉼표·큰따옴표가 든 이름을 감싼다", () => {
    const [, line] = toRsvpCsv([row({ name: '홍,길"동' })]).split("\r\n");
    expect(line).toContain('"홍,길""동"');
  });

  it("수식으로 읽힐 이름 앞에 작은따옴표를 붙인다", () => {
    const [, line] = toRsvpCsv([row({ name: "=1+1" })]).split("\r\n");
    expect(line).toContain("'=1+1");
  });

  it("다른 수식 시작 문자도 막는다", () => {
    for (const name of ["+82", "-1", "@sum"]) {
      const [, line] = toRsvpCsv([row({ name })]).split("\r\n");
      expect(line).toContain(`'${name}`);
    }
  });

  it("평범한 이름은 그대로 둔다", () => {
    const [, line] = toRsvpCsv([row({ name: "홍길동" })]).split("\r\n");
    expect(line).toContain(",홍길동,");
  });

  it("줄바꿈은 CRLF 다", () => {
    expect(toRsvpCsv([row()])).toContain("\r\n");
  });
});

describe("rsvpCsvBlob", () => {
  it("UTF-8 BOM 으로 시작한다", async () => {
    const bytes = new Uint8Array(await rsvpCsvBlob([row()]).arrayBuffer());

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe("rsvpCsvFileName", () => {
  it("KST 날짜를 파일명에 넣는다", () => {
    const day = "2026-08-19";

    expect(rsvpCsvFileName(Date.parse("2026-08-18T15:30:00.000Z"))).toBe(`rsvp-${day}.csv`);
  });
});
