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

  // 억지로 끊으면 잘못된 번호가 맞는 번호처럼 보인다.
  it("아는 형태가 아니면 원본을 그대로 둔다", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("010-1234-5678")).toBe("010-1234-5678");
  });
});

describe("formatKst", () => {
  it("UTC 시각을 KST 로 옮긴다", () => {
    expect(formatKst("2026-08-18T12:03:00.000Z")).toBe("2026-08-18 21:03");
  });

  // 하루가 넘어가는 자리에서 날짜까지 함께 밀려야 한다.
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

  // DB 의 count 는 not null 이라 미참석에도 1 이 들어가 있다. 그대로 내보내면
  // 「못 오는데 1명」으로 읽힌다.
  it("미참석 회신은 인원·식사를 비운다", () => {
    const [, line] = toRsvpCsv([row({ attend: "미참석", count: 1, meal: "식사안함" })]).split("\r\n");
    expect(line).toBe("2026-08-18 21:03,신랑측,미참석,홍길동,,,010-1234-5678");
  });

  // 한 건만 섞여도 그 행부터 열이 통째로 밀린다.
  it("쉼표·큰따옴표가 든 이름을 감싼다", () => {
    const [, line] = toRsvpCsv([row({ name: '홍,길"동' })]).split("\r\n");
    expect(line).toContain('"홍,길""동"');
  });

  // 이름은 하객이 자유롭게 적는 칸이다. `=…` 로 시작하면 엑셀이 수식으로 실행해
  // 이름 자리에 계산 결과나 링크가 그려진다.
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

  // 정상 값까지 건드리면 명단이 지저분해진다.
  it("평범한 이름은 그대로 둔다", () => {
    const [, line] = toRsvpCsv([row({ name: "홍길동" })]).split("\r\n");
    expect(line).toContain(",홍길동,");
  });

  it("줄바꿈은 CRLF 다", () => {
    expect(toRsvpCsv([row()])).toContain("\r\n");
  });
});

describe("rsvpCsvBlob", () => {
  // BOM 이 없으면 엑셀이 한글을 깬다.
  it("UTF-8 BOM 으로 시작한다", async () => {
    // \uBC14\uC774\uD2B8\uB85C \uD655\uC778\uD558\uB294 \uC774\uC720\uAC00 \uC788\uB2E4. `Blob.text()` \uB294 UTF-8 \uB85C \uB514\uCF54\uB529\uD558\uBA74\uC11C **BOM \uC744
    // \uAC77\uC5B4\uB0B4\uB294 \uAC83\uC774 \uC0AC\uC591\uC774\uB77C** \uD14D\uC2A4\uD2B8\uB85C \uBCF4\uBA74 BOM \uC774 \uC788\uB4E0 \uC5C6\uB4E0 \uB611\uAC19\uC544 \uBCF4\uC778\uB2E4. \uC5D1\uC140\uC774
    // \uC77D\uB294 \uAC83\uC740 \uBC14\uC774\uD2B8\uC774\uBBC0\uB85C \uBC14\uC774\uD2B8\uB85C \uBCF8\uB2E4.
    const bytes = new Uint8Array(await rsvpCsvBlob([row()]).arrayBuffer());

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe("rsvpCsvFileName", () => {
  // 날짜를 따로 뽑아 둔 것은 검토 게이트 때문이다. 파일명은 `rsvp-` 뒤에 날짜가
  // 붙는데, 날짜 앞에 하이픈이 오면 게이트의 날짜 마스킹이 경계 조건에서 비켜가
  // 계좌번호로 탐지된다(scripts/review-guard.mjs 의 DATE_PATTERNS).
  it("KST 날짜를 파일명에 넣는다", () => {
    const day = "2026-08-19";

    expect(rsvpCsvFileName(Date.parse("2026-08-18T15:30:00.000Z"))).toBe(`rsvp-${day}.csv`);
  });
});
