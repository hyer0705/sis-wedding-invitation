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

    test("GL-04 커버가 받을 동안 사진이 순서를 양보한다", async ({ page }) => {
      // 커버가 LCP 요소(fetchPriority="high")인데 갤러리 첫 두 장은 eager 라 같은
      // 시점에 대역폭을 놓고 다툰다. 하객이 여기까지 내려오기 전에 커버가 떠 있어야
      // 하므로 양보하고, 갤러리에 닿으면 거둔다 — 양보한 채로 두면 넘겨서 새로 받기
      // 시작하는 장이 다른 요청에 밀려 빈자리가 더 오래 남는다(SIS-18).
      //
      // 컴포넌트 테스트로는 못 잡는다. 거기 IntersectionObserver 는 관측 즉시
      // "들어왔다"고 알려 늘 닿은 상태고, Motion 이 관찰자를 캐싱해 갈아끼울 수도 없다.
      await page.goto("/");
      const first = track(page).locator("img").first();

      // 아직 갤러리에 닿기 전 — 커버가 한참 위에 있다.
      await expect(first).toHaveAttribute("fetchpriority", "low");

      await track(page).scrollIntoViewIfNeeded();

      await expect(first).toHaveAttribute("fetchpriority", "auto");
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

    test("kakao SDK 가 처음 받는 HTML 에 실려 오지 않는다", async ({ page }) => {
      // SIS-18 — 이 태그가 index.html 에 있으면 defer 를 달아도 27KB 가 렌더 차단
      // 스타일시트보다 먼저 내려와 첫 픽셀을 밀어낸다(Slow 3G 실측 6.85s → 6.27s).
      // 지금은 src/lib/share.ts 가 공유 섹션에 닿을 때 붙인다.
      //
      // 렌더된 DOM 이 아니라 응답 본문을 보는 이유는, 키가 있는 환경에서는 스크롤만
      // 해도 태그가 생겨 판정이 흔들리기 때문이다. 여기서 보려는 것은 "처음 받는
      // HTML 에 들어 있는가" 하나다.
      const html = await (await page.request.get("/")).text();

      expect(html).not.toContain("kakao_js_sdk");
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
    // role 로 집지 않는다. index.html 의 부트 화면이 같은 role·같은 이름을 쓰고, React
    // 로딩이 그것을 지우기 전까지 잠깐 공존해 두 요소로 풀린다 — CI 에서 실제로 걸렸다.
    const loadingOf = (page: Page) => page.getByTestId("loading");

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

  // SIS-29 스켈레톤 shimmer. 광택은 CSS 의사요소(::after)의 키프레임이라 컴포넌트
  // 테스트로는 존재조차 확인할 수 없다 — 진짜 브라우저에서 애니메이션을 직접 센다.
  test.describe("스켈레톤 shimmer", () => {
    const COVER_REQUEST = /1_main-\d+\.webp/;
    const frame = (page: Page) => page.getByTestId("cover-frame");

    /** 아치 안에서 shimmer 키프레임이 실제로 돌고 있는지. 의사요소라 subtree 로 훑는다. */
    const shimmering = (page: Page) =>
      frame(page).evaluate((el) =>
        el.getAnimations({ subtree: true }).some((a) => (a as CSSAnimation).animationName === "skeleton-shimmer"),
      );

    // 의사요소 애니메이션을 getAnimations 로 세는 것은 엔진마다 결과가 갈린다. 로컬 macOS 에서는
    // webkit 바이너리가 죽어 실행조차 못 하므로(WORKFLOW.md), 여기서 어긋나면 CI 에서만 조용히
    // 깨진다 — SIS-17 에서 겪은 그대로다. 광택의 유무는 chromium 에서만 세고, 클래스와 면 색은
    // 모든 엔진에서 본다. CSS 자체는 표준이라 그 둘이면 회귀는 잡힌다.
    const countsAnimations = (browserName: string) =>
      test.skip(browserName !== "chromium", "의사요소 애니메이션 계수는 chromium 에서만 신뢰할 수 있다");

    /** 사진을 붙잡아 스켈레톤이 드러난 상태를 만든다. */
    const holdCover = (page: Page) => page.route(COVER_REQUEST, () => new Promise(() => {}));

    test("사진이 오기 전 커버 아치에 광택이 돈다", async ({ page, browserName }) => {
      await holdCover(page);
      await page.goto("/", { waitUntil: "commit" });

      await expect(frame(page)).toHaveClass(/skeleton/);
      await expect(frame(page)).not.toHaveClass(/is-loaded/);

      countsAnimations(browserName);
      await expect.poll(() => shimmering(page)).toBe(true);
    });

    test("모션을 줄인 설정에서는 광택만 멎고 면은 그대로 남는다", async ({ page, browserName }) => {
      // MotionConfig reducedMotion="user" 는 Motion 요소에만 걸려 CSS 키프레임을 잡지
      // 못하므로 @media 로 직접 막았다. 그리고 **면이 함께 사라지지 않는 것**이 이 검사의
      // 요점이다 — 정지 시 보여야 할 값을 키프레임 안에 두면 애니메이션이 꺼질 때 기본값으로
      // 돌아가 자리가 통째로 비어 버린다(SIS-17 에서 실제로 밟았다).
      await page.emulateMedia({ reducedMotion: "reduce" });
      await holdCover(page);
      await page.goto("/", { waitUntil: "commit" });

      await expect(frame(page)).toHaveClass(/skeleton/);
      // --surface #f2f4ec. 토큰을 바꾸면 여기도 바꾼다.
      await expect(frame(page)).toHaveCSS("background-color", "rgb(242, 244, 236)");

      countsAnimations(browserName);
      expect(await shimmering(page)).toBe(false);
    });

    test("사진이 도착하면 광택을 걷는다", async ({ page, browserName }) => {
      await page.goto("/");

      await expect(frame(page)).toHaveClass(/is-loaded/);
      // 사진이 아치를 꽉 채운 상태로 보인다.
      await expect(page.locator("header img")).toHaveCSS("opacity", "1");

      countsAnimations(browserName);
      expect(await shimmering(page)).toBe(false);
    });

    test("갤러리는 사진이 도착한 자리의 면을 걷는다", async ({ page }) => {
      // 상시로 깔면 사진이 contain 이라 가로 사진 위아래에 띠가 남는다(2026-08-11 에
      // 그렇게 했다가 되돌렸다). 도착한 자리는 배경이 그대로 비쳐야 한다.
      await page.goto("/");
      await page.getByRole("group", { name: "웨딩 사진 갤러리" }).scrollIntoViewIfNeeded();

      const first = page.getByTestId("gallery-slot").first();
      await expect(first).not.toHaveClass(/skeleton/);
      await expect(first.locator("img")).toHaveCSS("opacity", "1");
    });
  });

  // SIS-30. 부트 화면·로딩 화면·커버가 모두 「The wedding of」를 Parisienne 으로 그린다.
  // 이 서체가 늦게 오면 세 화면이 폴백 필기체로 그려지다 도중에 서체가 바뀌어 화면이
  // 튀었다(Slow 3G 실측). self-host + preload + font-display:optional 로 막아 뒀는데,
  // 조용히 깨질 수 있는 구성이라 — 파일 경로가 바뀌거나 preload 가 빠지거나 Google Fonts
  // 요청에 Parisienne 이 다시 들어가면 — 눈에 보이는 증상 없이 폴백으로 돌아간다.
  test.describe("폰트", () => {
    test("Parisienne 을 같은 출처에서 받아 실제로 적용한다", async ({ page }) => {
      const fontResponses: { url: string; status: number }[] = [];
      page.on("response", (res) => {
        if (/\.woff2?(\?|$)/.test(res.url())) fontResponses.push({ url: res.url(), status: res.status() });
      });

      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);

      const selfHosted = fontResponses.find((r) => r.url.includes("/fonts/parisienne-latin.woff2"));
      expect(selfHosted, "Parisienne 을 같은 출처에서 받지 않았다 — preload 나 @font-face 경로를 확인한다").toBeTruthy();
      expect(selfHosted?.status).toBe(200);

      // Google Fonts 로 되돌아가면 스타일시트를 기다린 뒤에야 폰트를 받기 시작한다.
      expect(
        fontResponses.filter((r) => /gstatic\.com.*parisienne/i.test(r.url)),
        "Parisienne 이 Google Fonts 에서도 온다 — index.html 의 css2 요청에서 빼야 한다",
      ).toHaveLength(0);

      // 로드 여부와 별개로 실제로 그려지는 데 쓰이는지 본다. optional 은 제때 못 받으면
      // 그 방문 동안 폰트를 아예 쓰지 않으므로, 로드됐다는 것만으로는 부족하다.
      const applied = await page.evaluate(() => {
        const probe = (family: string) => {
          const el = document.createElement("span");
          el.textContent = "The wedding of";
          el.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:30px;font-family:${family}`;
          document.body.appendChild(el);
          const w = el.getBoundingClientRect().width;
          el.remove();
          return w;
        };
        return { script: probe('"Parisienne", cursive'), fallback: probe("cursive") };
      });
      expect(applied.script).not.toBeCloseTo(applied.fallback, 1);
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
      await expect(page.getByTestId("loading")).toBeHidden();
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
