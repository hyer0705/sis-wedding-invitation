import { describe, expect, it } from "vitest";
import { forbiddenReason, maskDates, scanText } from "./review-guard.mjs";

// 이 파일에 등장하는 번호는 전부 형식만 흉내 낸 가짜 값이다.
// (review-guard.mjs가 자기 자신과 이 테스트 파일을 스캔 예외로 두고 있다)

describe("scanText — 개인정보", () => {
  it("3마디 계좌번호를 적발한다", () => {
    const found = scanText("계좌: 110-123-456789", "src/components/Accounts.tsx");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: "개인정보", rule: "계좌번호" });
  });

  it("4마디 계좌번호를 적발한다", () => {
    // 기업은행처럼 마디가 넷인 형식도 실제로 쓰인다
    const found = scanText("계좌: 123-456789-01-011", "docs/notes.md");
    expect(found.map((f) => f.rule)).toContain("계좌번호");
  });

  it("휴대폰 번호를 적발한다", () => {
    const found = scanText("연락처 010-9876-5432 입니다", "src/components/Footer.tsx");
    expect(found.map((f) => f.rule)).toContain("휴대폰 번호");
  });

  // 입력칸의 힌트("ex) …")가 쓰는 값이다. 모두 같은 숫자로 적으면 게이트는 통과하지만
  // 하객이 보고 「번호를 적는 칸」이라고 알아채지 못한다.
  it("예시 번호는 적발하지 않는다", () => {
    expect(scanText("ex) 01012345678", "src/components/Rsvp.tsx")).toEqual([]);
    expect(scanText("010-1234-5678", "src/components/Rsvp.tsx")).toEqual([]);
  });

  // 예외는 목록에 적은 값에만 걸린다. 한 자리만 달라도 다시 잡혀야 한다.
  it("예시와 한 자리만 다른 번호는 적발한다", () => {
    const found = scanText("010-1234-5679", "src/components/Rsvp.tsx");
    expect(found.map((f) => f.rule)).toContain("휴대폰 번호");
  });

  it("주민등록번호를 적발한다", () => {
    const found = scanText("900101-1234567", "docs/notes.md");
    expect(found.map((f) => f.rule)).toContain("주민등록번호");
  });

  it("적발한 값을 그대로 노출하지 않는다", () => {
    // 터미널·CI 로그에 원문이 남으면 유출이 한 번 더 일어난다
    const [found] = scanText("110-123-456789", "src/x.ts");
    expect(found.hint).not.toContain("456789");
    expect(found.hint).toContain("*");
  });

  it("몇 번째 줄인지 알려준다", () => {
    const [found] = scanText("a\nb\n010-9876-5432", "src/x.ts");
    expect(found.line).toBe(3);
  });

  it("배포 게이트용 placeholder는 통과시킨다", () => {
    // 000-000-000000은 CLAUDE.md·WORKFLOW.md·verify-release.mjs에 규칙으로 적혀 있다.
    // 막으면 그 문서를 고칠 때마다 커밋이 실패한다.
    expect(scanText("placeholder(`000-000-000000`)가 남아 있으면 배포 금지", "CLAUDE.md")).toEqual([]);
  });

  it("휴대폰 번호를 계좌번호로 중복 보고하지 않는다", () => {
    // 3마디라 계좌 정규식에도 걸린다
    const found = scanText("010-9876-5432", "src/x.ts");
    expect(found).toHaveLength(1);
  });
});

describe("scanText — 날짜 오탐 방지 (회귀 방지의 핵심)", () => {
  it("INVITE.dateISO 형식을 계좌번호로 오인하지 않는다", () => {
    expect(scanText('dateISO: "2027-01-24T11:00:00+09:00"', "src/lib/calendar.ts")).toEqual([]);
  });

  it("INVITE.dateDots 형식을 계좌번호로 오인하지 않는다", () => {
    expect(scanText('dateDots: "2027 . 01 . 24"', "src/components/Footer.tsx")).toEqual([]);
  });

  it("이미지 폭 표기를 계좌번호로 오인하지 않는다", () => {
    // 계좌 정규식을 2마디까지 넓히면 여기서 오탐이 난다
    expect(scanText("srcSet: wedding-480.webp 480w, wedding-960.webp 960w", "src/components/Gallery.tsx")).toEqual([]);
  });

  it("마스킹은 길이를 보존해 줄 번호를 흐트러뜨리지 않는다", () => {
    const text = "2027-01-24";
    expect(maskDates(text)).toHaveLength(text.length);
  });
});

describe("scanText — 시크릿", () => {
  it("Apps Script 배포 URL을 적발한다", () => {
    const url = "https://script.google.com/macros/s/AKfycbwABCDEFGHIJKLMNOPQRSTUVWXYZ0123/exec";
    expect(scanText(`const endpoint = "${url}";`, "src/lib/rsvp.ts").map((f) => f.rule)).toContain("Apps Script 배포 URL");
  });

  it("Google API 키를 적발한다", () => {
    const key = `AIza${"b".repeat(35)}`;
    expect(scanText(key, "index.html").map((f) => f.rule)).toContain("Google API 키");
  });

  it("개인키 블록을 적발한다", () => {
    expect(scanText("-----BEGIN RSA PRIVATE KEY-----", "src/x.ts").map((f) => f.rule)).toContain("개인키 블록");
  });

  it("환경변수 참조는 시크릿으로 잡지 않는다", () => {
    expect(scanText("const apiKey = import.meta.env.VITE_KAKAO_JS_KEY;", "src/lib/share.ts")).toEqual([]);
  });
});

describe("scanText — 예외 경로", () => {
  it("src/invite.ts 의 개인정보는 통과시킨다", () => {
    // 고객 정보의 유일한 저장소다. 여기 있는 것이 정상이고 밖으로 나가는 것이 사고다
    expect(scanText("account: '110-123-456789'", "src/invite.ts")).toEqual([]);
  });

  it("src/invite.ts 라도 시크릿은 막는다", () => {
    const url = "https://script.google.com/macros/s/AKfycbwABCDEFGHIJKLMNOPQRSTUVWXYZ0123/exec";
    expect(scanText(url, "src/invite.ts")).toHaveLength(1);
  });

  it("drafts/ 는 검사하지 않는다", () => {
    expect(scanText("010-1234-5678", "drafts/c.dc.html")).toEqual([]);
  });
});

describe("forbiddenReason", () => {
  it.each([
    [".env", "환경변수"],
    ["public/images/mock/1-480.webp", "mock"],
    ["photos-original/wedding_2.jpeg", "원본"],
    ["src/.DS_Store", "macOS"],
    ["certs/server.pem", "인증서"],
    ["public/hero.png", "래스터"],
  ])("%s 를 막는다", (file) => {
    expect(forbiddenReason(file)).toBeTruthy();
  });

  it.each([
    ".env.example",
    "public/og-image.jpg",
    "public/images/wedding_1-480.webp",
    "src/invite.ts",
    "drafts/images/wedding_1.jpeg",
  ])("%s 는 통과시킨다", (file) => {
    expect(forbiddenReason(file)).toBeNull();
  });
});
