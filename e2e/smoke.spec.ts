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

      await expect(page.getByTestId("toast")).toHaveText("주소가 복사되었습니다");
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toBe(INVITE.address);
    });
  });

  // AC-01·AC-02 — 마음 전하실 곳. 계좌는 환경변수로만 들어오고 mock 이 없어, 여기서 보는
  // 값은 playwright.config.ts 의 webServer.env 가 넣은 가짜다. INVITE 를 기대값으로 쓰지
  // 않는 이유는 그 파일이 Vite 를 거치지 않고 읽혀 계좌가 늘 비기 때문이다.
  test.describe("마음 전하실 곳", () => {
    test("아코디언을 열면 계좌가 나오고 복사가 실제 클립보드에 들어간다", async ({ page, context, browserName }) => {
      test.skip(browserName !== "chromium", "clipboard-read 권한은 chromium 전용");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/");

      const groom = page.getByRole("button", { name: /^신랑측/ });
      await groom.click();

      // 측당 2건이 모두 보여야 한다 — 형식이 어긋난 항목은 조용히 버려지므로 건수를 센다.
      await expect(page.getByRole("button", { name: /계좌번호 복사$/ })).toHaveCount(2);

      await page
        .getByRole("button", { name: /계좌번호 복사$/ })
        .first()
        .click();

      await expect(page.getByTestId("toast")).toHaveText("계좌번호가 복사되었습니다");
      // 하이픈째 복사한다. 화면에 보이는 값과 같아야 하객이 붙여넣고 대조할 수 있다.
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("111-111-111111");
    });
  });

  // SH-01·SH-02 — 공유. 카카오 SDK 는 외부 CDN 에서 오고 도메인 화이트리스트에 걸려
  // localhost 프리뷰에서는 어차피 카드가 뜨지 않는다. 카카오 경로는 유닛 테스트가 덮고
  // (src/lib/share.test.ts), 여기서는 눌러도 안전한 링크 복사만 실제로 확인한다.
  test.describe("공유", () => {
    test("공유 버튼 두 개가 푸터 위에 있다", async ({ page }) => {
      await page.goto("/");

      const share = page.getByRole("region", { name: "청첩장 공유" });
      await expect(share.getByRole("button", { name: "카카오톡으로 공유" })).toBeVisible();
      await expect(share.getByRole("button", { name: "링크 복사" })).toBeVisible();

      // 자리가 푸터 위라는 것이 이 섹션의 설계다 — 청첩장을 다 읽은 뒤에 "전해 주세요"가
      // 나온다. 순서가 뒤집히면 인사말이 마지막이 아니게 된다.
      const order = await page.evaluate(() => {
        const section = document.querySelector('[aria-label="청첩장 공유"]');
        const footer = document.querySelector("footer");
        if (!section || !footer) return null;
        return section.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING ? "before" : "after";
      });
      expect(order).toBe("before");
    });

    test("링크 복사가 배포 주소를 클립보드에 넣는다", async ({ page, context, browserName }) => {
      test.skip(browserName !== "chromium", "clipboard-read 권한은 chromium 전용");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/");

      await page.getByRole("button", { name: "링크 복사" }).click();

      await expect(page.getByTestId("toast")).toHaveText("청첩장 주소가 복사되었습니다");
      // location.href 가 아니라 INVITE.siteUrl 이어야 한다. 프리뷰에서 공유했을 때
      // 임시 주소가 하객에게 나가는 것을 막는 자리다 — 여기서는 localhost 가 아닌지가
      // 곧 그 증거다.
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(INVITE.siteUrl);
    });

    test("OG 태그가 INVITE.share 문구를 그대로 싣는다", async ({ page }) => {
      // SH-03 은 명세서에서 유일한 「필수」다. 카톡에 링크를 붙여넣는 순간 보이는 화면이라
      // 깨진 채 배포되면 스크래퍼가 그 상태로 캐싱한다.
      await page.goto("/");

      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", INVITE.share.title);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", INVITE.share.description);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", INVITE.siteUrl);
      // 썸네일은 R2 절대 URL 이다. 상대 경로면 카카오 스크래퍼가 읽지 못한다.
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/.+\/og-image\.jpg$/);
    });
  });

  // CM-04 로딩 화면. 사진이 캐시에서 오면 눈 깜짝할 새에 걷혀 화면에 잡히지 않으므로,
  // 커버 사진 요청만 붙잡아 두고 본다.
  //
  // 로딩 화면 자체의 axe 감사는 따로 두지 않았다. 안에 있는 것이 aria-hidden 글씨와 선
  // 둘뿐이고, 감사 대상이 되는 것은 role·이름을 가진 바깥 컨테이너 하나다.
  test.describe("로딩 화면", () => {
    const COVER_REQUEST = /1_main-\d+\.webp/;
    const loadingOf = (page: Page) => page.getByRole("status", { name: "청첩장을 불러오는 중" });

    test("커버 사진이 도착하면 걷히고 청첩장이 드러난다", async ({ page }) => {
      await page.route(COVER_REQUEST, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      });

      await page.goto("/", { waitUntil: "commit" });

      await expect(loadingOf(page)).toBeVisible();
      await expect(loadingOf(page)).toBeHidden({ timeout: 6000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });

    // R2 가 죽었거나 회선이 끊긴 경우다. 상한이 없으면 사진 한 장 때문에 청첩장을
    // 통째로 못 본다 — 응답을 영영 주지 않는 요청으로 그 경로를 만든다.
    test("커버 사진이 오지 않아도 상한에서 걷힌다", async ({ page }) => {
      await page.route(COVER_REQUEST, () => new Promise(() => {}));

      await page.goto("/", { waitUntil: "commit" });

      await expect(loadingOf(page)).toBeVisible();
      await expect(loadingOf(page)).toBeHidden({ timeout: 8000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });

  // 페이드인이 진행 중이면 axe가 합성된 중간 색상을 읽어 색상 대비를 오탐한다.
  // reduced-motion으로 애니메이션을 건너뛰어 최종 상태를 검사하고,
  // 동시에 prefers-reduced-motion 대응(MotionConfig reducedMotion="user")도 함께 검증한다.
  test.describe("접근성", () => {
    test.use({ reducedMotion: "reduce" });

    test("critical/serious 위반이 없다", async ({ page }) => {
      await page.goto("/");
      // 색상 대비 판정은 스타일·폰트가 적용되고 화면이 자리를 잡은 뒤라야 의미가 있다.
      // 커버 자체의 페이드인은 로딩 화면이 걷히는 연출로 옮겨져 사라졌지만(Cover.tsx),
      // 로딩 오버레이가 남아 있는 동안 감사하면 그 아래가 통째로 가려진다. opacity 가
      // 1인 것을 확인하는 것으로 오버레이가 걷혔음까지 함께 본다.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("status", { name: "청첩장을 불러오는 중" })).toBeHidden();
      await expect(page.locator("header")).toHaveCSS("opacity", "1");

      // 아코디언은 기본이 접힘이고 닫힌 패널은 DOM 에서 빠진다. 열어 두지 않으면 계좌 행과
      // 복사 버튼이 감사 대상에 아예 없어, 그 안의 위반은 CI 가 영영 보지 못한다.
      for (const label of [/^신랑측/, /^신부측/]) {
        await page.getByRole("button", { name: label }).click();
      }
      await expect(page.getByRole("button", { name: /계좌번호 복사$/ }).first()).toBeVisible();

      // 공유 버튼은 접히지 않아 늘 감사 대상이지만, 리빌이 끝나기 전에 감사가 돌면
      // 반투명 상태의 색을 읽는다. 보이는 것을 확인하고 넘어간다.
      await expect(page.getByRole("button", { name: "카카오톡으로 공유" })).toBeVisible();

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
