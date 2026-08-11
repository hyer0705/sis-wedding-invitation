import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { INVITE } from "../src/invite";

test.describe("청첩장 기본 동작", () => {
  test("페이지가 열리고 신랑·신부 이름과 예식 일시가 보인다", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // 날짜를 적어 두면 예식 일시가 바뀔 때마다 여기도 고쳐야 한다. INVITE를 본다.
    await expect(page.getByText(INVITE.dateText)).toBeVisible();
  });

  test("커버부터 푸터까지 스크롤하는 동안 콘솔 에러가 없다", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  // DT-01 — 320px 에서 "…오전 11" / "시" 로 끊겨 마지막 한 글자만 다음 줄에 남던 적이
  // 있다. 날짜와 시각을 각각 덩어리로 묶어 막았고, 폰트나 문구가 바뀌면 되살아나기 쉽다.
  // 320px 에서는 두 줄이 되는 것이 정상이며, 각 덩어리가 쪼개지지 않는 것이 조건이다.
  test("예식 일시가 날짜·시각 덩어리째로만 줄바꿈된다", async ({ page }) => {
    await page.goto("/");

    for (const part of [INVITE.dateText, INVITE.dayText]) {
      const chunk = page.getByText(part, { exact: true });
      const { height, fontSize } = await chunk.evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      }));

      // 한 줄이면 글자 크기의 1.4배쯤, 두 줄이면 2.7배쯤 된다.
      expect(height, `"${part}" 이 두 줄로 쪼개졌다`).toBeLessThan(fontSize * 2);
    }
  });

  // IN-01·IN-02 — 인사말과 인용 시의 줄바꿈은 고객이 정한 것이라 화면에서도 그대로
  // 앉아야 한다. c안 본문 크기(16.5)로는 375px 에서 두 문단이 한 줄씩 더 접혀
  // 마지막 낱말만 홀로 떨어졌고, 그래서 이 카드만 14.5 로 낮춰 맞춰 두었다.
  // 크기·패딩·문구 어느 하나만 건드려도 되살아나므로 여기서 고정한다.
  //
  // 320px 은 제외한다. 그 폭에서 지키려면 11.5px 이하여야 해 읽을 수 없어진다.
  test("인사말과 인용 시가 고객이 지정한 줄바꿈대로 앉는다", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 375, "320px 은 읽을 수 있는 크기로 지킬 수 없다");
    await page.goto("/");

    // 본문 폰트는 Google Fonts 에서 display=swap 으로 온다. 도착 전에는 폴백 serif 로
    // 그려지는데 그 폭이 달라 줄 수가 어긋난다 — 기다리지 않으면 무작위로 실패한다.
    // 아예 받지 못한 환경에서는 잴 대상 자체가 없으므로 건너뛴다.
    await page.evaluate(() => document.fonts.ready);
    const fontReady = await page.evaluate(() => document.fonts.check("14.5px 'Nanum Myeongjo'"));
    test.skip(!fontReady, "본문 웹폰트를 받지 못했다 — 폴백 폰트로는 줄 수를 잴 수 없다");

    // 문단은 순서가 아니라 글로 찾는다. nth 인덱스로 짚으면 문단이 하나만 늘거나
    // 자리를 바꿔도 조용히 엉뚱한 문단을 재면서 통과해 버린다.
    // Playwright 의 텍스트 매칭은 공백을 하나로 눌러 비교하므로, 고객이 넣은 \n 도
    // 같은 모양으로 눌러서 건넨다.
    const blocks = [...INVITE.greeting.body, ...INVITE.greeting.quote];

    for (const block of blocks) {
      const authored = block.split("\n").length;
      // 원문에 줄바꿈이 없는 문단은 폭에 맞춰 저절로 접히는 것이 정상이다.
      if (authored === 1) continue;

      const paragraph = page.getByText(block.replace(/\s+/g, " ").trim(), { exact: true });
      const rendered = await paragraph.evaluate((el) =>
        Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
      );

      const label = block.split("\n")[0];
      expect(rendered, `"${label}…" 문단이 ${authored}줄 대신 ${rendered}줄로 접혔다`).toBe(authored);
    }
  });

  test("가로 스크롤이 발생하지 않는다", async ({ page }) => {
    await page.goto("/");
    // CM-01: 320~430px 어디서도 페이지가 가로로 넘치면 안 된다
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  // CV-02 — 커버 패럴랙스. 스크롤 값에 직접 물린 애니메이션이라 MotionConfig가
  // 대신 꺼주지 않는다. 동작과 reduced-motion 대응을 양쪽 다 고정한다.
  test.describe("커버 패럴랙스", () => {
    const coverTransform = (page: Page) => page.locator("header img").evaluate((el) => getComputedStyle(el).transform);

    test("스크롤하면 커버 사진이 따라 내려온다", async ({ page }) => {
      await page.goto("/");
      const before = await coverTransform(page);

      await page.evaluate(() => window.scrollTo(0, 400));
      await expect.poll(() => coverTransform(page)).not.toBe(before);
    });

    test("모션을 줄인 설정에서는 사진이 움직이지 않는다", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const before = await coverTransform(page);

      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(300);
      expect(await coverTransform(page)).toBe(before);
    });
  });

  // GL-01 — 갤러리 슬라이드. 손가락으로 넘겼을 때 카운터가 따라오는지, 화살표가
  // 스크롤러를 실제로 움직이는지는 진짜 브라우저에서만 확인된다.
  test.describe("갤러리 슬라이드", () => {
    const track = (page: Page) => page.getByRole("group", { name: "웨딩 사진 갤러리" });
    // [aria-live] 로 잡지 않는다. 토스트(SIS-17)처럼 알림 영역이 하나 더 생기는 순간
    // 선택자가 두 요소로 풀려, 갤러리와 무관한 변경에 이 테스트들이 함께 깨진다.
    const counter = (page: Page) => page.getByTestId("gallery-counter");

    test("스크롤해서 넘기면 현재 위치 표시가 따라온다", async ({ page }) => {
      await page.goto("/");
      await track(page).scrollIntoViewIfNeeded();
      await expect(counter(page)).toHaveText(`1 / ${INVITE.gallery.length}`);

      // 스와이프와 같은 결과를 만든다 — 스크롤러를 세 칸 옮긴다.
      await track(page).evaluate((el) => {
        const step = (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
        el.scrollTo({ left: step * 3, behavior: "auto" });
      });

      await expect(counter(page)).toHaveText(`4 / ${INVITE.gallery.length}`);
    });

    test("화살표를 누르면 스크롤러가 실제로 움직인다", async ({ page }) => {
      await page.goto("/");
      await track(page).scrollIntoViewIfNeeded();

      await page.getByRole("button", { name: "다음 사진" }).click();

      await expect.poll(() => track(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await expect(counter(page)).toHaveText(`2 / ${INVITE.gallery.length}`);
    });

    test("첫 장과 끝 장에서 갈 수 없는 쪽 화살표가 잠긴다", async ({ page }) => {
      await page.goto("/");
      await track(page).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "이전 사진" })).toBeDisabled();

      await track(page).evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "auto" }));

      await expect(counter(page)).toHaveText(`${INVITE.gallery.length} / ${INVITE.gallery.length}`);
      await expect(page.getByRole("button", { name: "다음 사진" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "이전 사진" })).toBeEnabled();
    });
  });

  // MP-02·MP-03 — 오시는 길. 링크 href와 클립보드는 진짜 브라우저에서만 확인된다.
  test.describe("오시는 길", () => {
    test("지도 앱 세 곳 링크가 예식장 좌표를 싣는다", async ({ page }) => {
      await page.goto("/");

      // 앱이 없는 하객에게도 갈 곳이 있어야 하므로 href는 웹 주소여야 한다.
      // 앱 스킴은 클릭 시점에 JS가 시도한다.
      for (const label of ["네이버지도", "카카오맵", "티맵"]) {
        await expect(page.getByRole("link", { name: label })).toHaveAttribute("href", /^https:\/\//);
      }

      const kakao = await page.getByRole("link", { name: "카카오맵" }).getAttribute("href");
      expect(decodeURIComponent(kakao ?? "")).toContain(`${INVITE.coords.lat},${INVITE.coords.lng}`);
    });

    test("주소 복사 버튼이 실제 클립보드에 주소를 넣는다", async ({ page, context, browserName }) => {
      // 클립보드 읽기 권한은 chromium에서만 부여할 수 있다. webkit은 실기기 수동 QA로 확인한다.
      test.skip(browserName !== "chromium", "clipboard-read 권한은 chromium 전용");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/");

      await page.getByRole("button", { name: "주소 복사하기" }).click();

      await expect(page.getByRole("status")).toHaveText("주소가 복사되었습니다");
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toBe(INVITE.address);
    });
  });

  // 페이드인이 진행 중이면 axe가 합성된 중간 색상을 읽어 색상 대비를 오탐한다.
  // reduced-motion으로 애니메이션을 건너뛰어 최종 상태를 검사하고,
  // 동시에 prefers-reduced-motion 대응(MotionConfig reducedMotion="user")도 함께 검증한다.
  test.describe("접근성", () => {
    test.use({ reducedMotion: "reduce" });

    test("critical/serious 위반이 없다", async ({ page }) => {
      await page.goto("/");
      // 색상 대비 판정은 스타일·폰트가 적용되고 페이드인이 끝난 뒤라야 의미가 있다.
      // reducedMotion은 transform만 줄이고 opacity 애니메이션은 그대로 두므로(Motion 사양)
      // 커버의 opacity가 1이 될 때까지 기다리지 않으면 합성된 중간 색상을 읽는다.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("header")).toHaveCSS("opacity", "1");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        // color-contrast는 의도적으로 제외한다.
        // c안 확정 토큰인 --muted(#a7a496, 대비 2.25)와 --text-sub(#7a766b, 대비 4.07)이
        // 배경 --bg(#f5f3ea) 위에서 WCAG AA 4.5:1에 미달한다. 토큰 변경은 고객 승인 사항이므로
        // 품질 게이트 이슈에서 별도로 다루고, 그 전까지 나머지 규칙만 강제한다.
        .disableRules(["color-contrast"])
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(blocking).toEqual([]);
    });

    test("모션을 줄인 설정에서도 콘텐츠가 보인다", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Thank you")).toBeVisible();
    });
  });
});
