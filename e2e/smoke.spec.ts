import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { INVITE } from "../src/invite";

/**
 * RSVP 폼은 버튼 뒤에 숨어 있다 (SIS-15). 폼을 보는 테스트는 여기서 시작한다.
 *
 * goto 는 부르는 쪽이 한다 — 접근성 감사는 페이지 상태를 이미 만들어 둔 뒤에 부르므로
 * 여기서 다시 열면 그 준비가 통째로 날아간다.
 */
async function openRsvpForm(page: Page) {
  const opener = page.getByRole("button", { name: "참석 여부 알리기" });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await expect(page.getByRole("button", { name: "신랑측 하객" })).toBeVisible();
}

/**
 * 회신 저장 요청을 가로채 답을 대신 준다 (SIS-20).
 *
 * 진짜 Supabase 로 보내면 테스트를 돌릴 때마다 고객 테이블에 회신이 쌓이고, 지울
 * 방법도 없다(anon 에는 delete 정책이 없다). 빌드에 박히는 주소는 해석되지 않는
 * `.invalid` 라(playwright.config.ts) 여기서 잡지 않은 요청은 그냥 실패한다.
 *
 * @returns 가로챈 요청의 본문. 실제로 무엇이 나갔는지 확인하는 데 쓴다.
 */
async function stubRsvpInsert(page: Page, { status = 201 } = {}) {
  const sent: unknown[] = [];

  await page.route("**/rest/v1/rsvp*", async (route) => {
    // 다른 출처로 가는 요청이라 브라우저가 preflight 를 먼저 보낸다. 여기에
    // 답해 주지 않으면 본 요청이 CORS 에서 막혀 스텁까지 오지도 못한다.
    //
    // 허용 헤더는 와일드카드가 아니라 **요청이 물어본 목록을 그대로 되돌린다.**
    // supabase-js 는 apikey·x-client-info 같은 커스텀 헤더를 실어 보내는데, 이
    // 자리의 `*` 를 어떻게 대조하는지는 엔진마다 다르다. webkit 은 CI 에서만
    // 도는지라(playwright.config.ts) 로컬에서 재현할 수 없는 실패가 되고,
    // 되돌려 주는 쪽은 어느 엔진에서든 통한다.
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": route.request().headers()["access-control-request-headers"] ?? "*",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    sent.push(JSON.parse(route.request().postData() ?? "null"));
    await route.fulfill({
      status,
      headers: { ...cors, "content-type": "application/json" },
      // select 를 붙이지 않으므로 PostgREST 는 성공에 빈 본문을 준다. 실패는 오류 객체다.
      body: status < 400 ? "" : JSON.stringify({ code: "23514", message: "check 제약 위반", details: "", hint: "" }),
    });
  });

  return sent;
}

/** 참석 회신을 동의 단계까지 채운다. 개인정보 안내는 그 단계에서야 나타난다. */
async function fillRsvpToConsent(page: Page) {
  await openRsvpForm(page);
  await page.getByRole("button", { name: "신랑측 하객" }).click();
  await page.getByRole("button", { name: "참석합니다" }).click();
  await page.getByLabel("성함").fill("홍길동");
  await page.getByLabel("참석 인원 (본인 포함)").fill("2");
  await page.getByLabel("연락처").fill("000-0000-0000");
  await page.getByRole("button", { name: "식사함" }).click();
  await expect(page.getByRole("checkbox")).toBeVisible();
}

/**
 * 제출 버튼을 눌러 확인 팝업까지 연다 (SIS-36).
 *
 * 「참석 의사 전하기」는 이제 전송이 아니라 팝업 열기다 — 검증을 통과해야 열린다.
 */
async function openRsvpConfirm(page: Page) {
  await page.getByRole("button", { name: "참석 의사 전하기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // 페이드가 끝나기를 기다린다. toBeVisible 은 opacity 를 보지 않아 전환 도중에도
  // 통과하는데, 그때 색상 대비를 검사하면 axe 가 반투명이 합성된 중간 색을 읽어
  // (--text #3a3631 을 옅은 회색으로) 팝업 전체를 오탐한다 — reducedMotion 을 켜도
  // transform 만 줄고 opacity 페이드는 남는다(Motion 사양).
  await expect(page.locator(".rsvp-confirm-overlay")).toHaveCSS("opacity", "1");
  return dialog;
}

test.describe("청첩장 기본 동작", () => {
  test("페이지가 열리고 신랑·신부 이름과 예식 일시가 보인다", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // 날짜를 적어 두면 예식 일시가 바뀔 때마다 여기도 고쳐야 한다. INVITE를 본다.
    await expect(page.getByText(INVITE.dateText)).toBeVisible();
  });

  // 방명록(SIS-21)이 화면에 뜨는 순간 목록을 읽는다. 그런데 이 테스트의 Supabase 주소는
  // 일부러 해석되지 않는 `.invalid` 라(playwright.config.ts), 그 요청이 반드시 실패하고
  // 브라우저가 「Failed to load resource」를 콘솔에 남긴다. **우리 코드가 남기는 것이
  // 아니라 브라우저가 남기는 것이라 JS 로는 막을 수 없다.**
  //
  // 그래서 그 주소를 향한 실패만 걷어낸다. 화면이 오류를 어떻게 다루는지는 컴포넌트
  // 테스트가 보고(Guestbook.test.tsx), 여기서는 **다른 콘솔 에러가 없는지**를 본다.
  // 걷어내는 범위를 이 주소로 좁혀 두었으므로 진짜 에러는 그대로 걸린다.
  //
  // ⚠ **주소가 어디에 실리는지가 브라우저마다 다르다.** webkit 은 메시지 글에 담아
  // 보내지만(`Error resolving “rsvp-e2e.invalid”…`), chromium 은 글에는
  // `Failed to load resource: net::ERR_NAME_NOT_RESOLVED` 만 적고 주소는 location 에
  // 둔다. 한쪽만 보면 다른 쪽에서 그대로 실패한다.
  const OFFLINE_HOST = "rsvp-e2e.invalid";
  const isExpectedOfflineFailure = (msg: ConsoleMessage) =>
    msg.text().includes(OFFLINE_HOST) || msg.location().url.includes(OFFLINE_HOST);

  test("커버부터 푸터까지 스크롤하는 동안 콘솔 에러가 없다", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isExpectedOfflineFailure(msg)) errors.push(msg.text());
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

  // IN-01 — 인사말의 줄바꿈은 고객이 정한 것이라 화면에서도 그대로 앉아야 한다.
  // c안 본문 크기(16.5)로는 375px 에서 두 문단이 한 줄씩 더 접혀 마지막 낱말만 홀로
  // 떨어졌고, 그래서 이 카드만 14.5 로 낮춰 맞춰 두었다. 크기·패딩·문구 어느 하나만
  // 건드려도 되살아나므로 여기서 고정한다. 인용 시(IN-02)가 빠진 뒤에도(2026-08-13)
  // 이 값은 그대로다 — 한 문단이 접히는지는 카드 폭이 정하지 카드 길이가 정하지 않는다.
  //
  // 320px 은 제외한다. 그 폭에서 지키려면 11.5px 이하여야 해 읽을 수 없어진다.
  test("인사말이 고객이 지정한 줄바꿈대로 앉는다", async ({ page }) => {
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
    for (const block of INVITE.greeting.body) {
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

  // CM-01 — 하객 대부분은 휴대폰으로 열지만 PC 카톡이나 태블릿으로 여는 사람도 있다.
  // 그 화면에서 청첩장은 430px 컬럼으로 가운데 서야 한다.
  //
  // 뷰포트를 프로젝트로 추가하지 않고 이 안에서만 바꾼다. 큰 화면용 프로젝트를 두면
  // 모바일 전용 검사(줄바꿈·갤러리 걸침)까지 전부 한 벌 더 돌아 시간만 늘고, 그 폭에서는
  // 기대값이 애초에 다르다.
  test.describe("태블릿·PC", () => {
    const WIDE = { width: 1280, height: 900 };

    /** 컬럼의 폭과 좌우 여백. 세로 스크롤바가 있어 뷰포트 폭 대신 clientWidth 로 잰다. */
    const column = (page: Page, selector: string) =>
      page.locator(selector).evaluate((el) => {
        const box = el.getBoundingClientRect();
        return { width: box.width, left: box.left, right: document.documentElement.clientWidth - box.right };
      });

    test("페이지가 430px 컬럼으로 가운데 선다", async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto("/");

      const { width, left, right } = await column(page, ".page");
      expect(width).toBe(430);
      expect(Math.abs(left - right), "컬럼이 가운데 서지 않았다").toBeLessThanOrEqual(1);
    });

    // 화면을 덮는 것들이 컬럼을 벗어나면, 걷히는 순간 청첩장이 화면 폭에서 컬럼으로
    // 쪼그라든 것처럼 보인다. 셋 다 position:fixed 라 놔두면 뷰포트 전체를 덮는다.
    test("로딩 화면이 컬럼 밖까지 덮지 않는다", async ({ page }) => {
      // 사진을 붙잡아 로딩 화면이 떠 있는 상태를 만든다.
      await page.route(/1_main-\d+\.webp/, () => new Promise(() => {}));
      await page.setViewportSize(WIDE);
      await page.goto("/", { waitUntil: "commit" });

      await expect(page.getByTestId("loading")).toBeVisible();

      const { width, left, right } = await column(page, '[data-testid="loading"]');
      expect(width).toBe(430);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    });

    test("부트 화면이 컬럼 밖까지 덮지 않는다", async ({ page }) => {
      // 번들을 막아 React 가 뜨기 전 상태를 붙잡는다 — 뜨는 순간 Loading 이 #boot 를 지운다.
      // 부트 화면의 스타일은 index.html 인라인이라 JS 를 막아도 그대로 걸린다.
      await page.route(/assets\/.*\.js$/, (route) => route.abort());
      await page.setViewportSize(WIDE);
      await page.goto("/", { waitUntil: "commit" });

      // commit 은 응답 헤더가 온 시점이라 문서가 아직 파싱되는 중이다. webkit 은 그
      // 사이의 #boot 를 규칙이 걸리지 않은 채로 내주어, 컬럼(430) 대신 화면 전체 폭이
      // 잡힌다 — CI 의 ios-safari 만 여기서 깨졌다(1264 수신). chromium 은 head 를 다
      // 읽을 때까지 그리지 않아 드러나지 않는다.
      //
      // 그래서 규칙이 걸릴 때까지 기다렸다가 잰다. 재는 값과 기대값은 그대로다.
      await expect(page.locator("#boot")).toHaveCSS("max-width", "430px");

      const { width, left, right } = await column(page, "#boot");
      expect(width).toBe(430);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    });

    test("가로 스크롤이 발생하지 않는다", async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto("/");

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });
  });

  // CV-02 — 커버 패럴랙스. 스크롤 값에 직접 물린 애니메이션이라 MotionConfig가
  // 대신 꺼주지 않는다. 동작과 reduced-motion 대응을 양쪽 다 고정한다.
  test.describe("커버 패럴랙스", () => {
    const coverTransform = (page: Page) => page.locator("header img").evaluate((el) => getComputedStyle(el).transform);

    /**
     * 패럴랙스를 재기 전에 화면이 준비되기를 기다린다.
     *
     * goto 는 load 에서 풀리는데 그 시점에는 로딩 오버레이(CM-04)가 아직 덮고 있고,
     * 스크롤 구독은 Cover 의 effect 가 마운트된 뒤에야 걸린다(Cover.tsx — useScroll 을
     * 쓰지 않고 직접 구독한다). 그 사이에 재면 스크롤을 흘려보낸다.
     *
     * **스크롤이 실제로 먹었는지도 확인한다.** 이것이 없으면 실패했을 때
     * 「스크롤이 안 됐다」와 「패럴랙스가 깨졌다」를 구분할 수 없다 — 2026-08-18 에
     * ios-safari 에서 이 테스트가 흔들렸을 때 로그만으로는 원인을 좁히지 못했다.
     */
    async function scrollPastCover(page: Page) {
      // 기본 5초로는 모자란다. 로딩 화면은 커버 사진 도착 또는 **상한 4초**(Loading.tsx 의
      // MAX_VISIBLE_MS) 중 먼저 오는 쪽에 걷히는데, CI 에는 사진이 없어(리포에 커밋하지
      // 않는다) 매번 상한을 꽉 채운다. 거기에 페이드가 더해져 여유가 1초도 남지 않고,
      // 워커들이 CPU 를 나눠 쓰면 그대로 넘어간다 — 실제로 넘어갔다(2026-08-18).
      await expect(page.getByTestId("loading")).toBeHidden({ timeout: 15_000 });
      const before = await coverTransform(page);

      await page.evaluate(() => window.scrollTo(0, 400));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

      return before;
    }

    test("스크롤하면 커버 사진이 따라 내려온다", async ({ page }) => {
      await page.goto("/");
      const before = await scrollPastCover(page);

      // 기본 5초는 여유가 없다. 스크롤 값에 물린 갱신이 한 프레임 늦게 커밋되는 일이
      // 있어(webkit) 여기서 시간을 조금 더 준다 — 늦게라도 따라오면 통과다.
      await expect.poll(() => coverTransform(page), { timeout: 10_000 }).not.toBe(before);
    });

    test("모션을 줄인 설정에서는 사진이 움직이지 않는다", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      // 「안 움직였다」를 보는 테스트라 준비 대기가 더 중요하다. 화면이 아직 스크롤될
      // 상태가 아니면 아무것도 안 한 채로 통과해 버린다.
      const before = await scrollPastCover(page);

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

    test("지도 앱 버튼 3개가 한 줄에 앉고 라벨이 접히지 않는다", async ({ page }) => {
      // SIS-32 에서 각 사 로고가 라벨 옆에 붙었다. 320px 에서 세 버튼의 최소 폭 합이
      // 카드 안쪽 폭에 거의 닿아, 로고·간격·글자 중 하나만 커져도 라벨이 접히거나
      // 버튼이 카드를 넘친다(nowrap 이라 접히는 대신 삐져나간다).
      await page.goto("/");

      // 웹폰트 도착 전 폴백으로 재면 폭이 달라 결과가 무작위로 흔들린다.
      await page.evaluate(() => document.fonts.ready);

      const row = page.locator(".map-links");
      const rowBox = await row.boundingBox();
      expect(rowBox).not.toBeNull();

      for (const label of ["네이버지도", "카카오맵", "티맵"]) {
        const link = page.getByRole("link", { name: label });

        // 라벨 텍스트 노드만 재서 줄 수를 센다. 로고까지 포함하면 높이가 섞인다.
        const lines = await link.evaluate((el) => {
          const textNode = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
          if (!textNode) return 0;
          const range = document.createRange();
          range.selectNodeContents(textNode);
          return range.getClientRects().length;
        });
        expect(lines, `"${label}" 라벨이 ${lines}줄로 접혔다`).toBe(1);

        // 카드를 넘치지 않는지는 버튼 줄 안에 들어 있는지로 본다.
        const box = await link.boundingBox();
        expect(box).not.toBeNull();
        expect(box.x, `"${label}" 버튼이 왼쪽으로 삐져나왔다`).toBeGreaterThanOrEqual(rowBox.x - 0.5);
        expect(box.x + box.width, `"${label}" 버튼이 오른쪽으로 삐져나왔다`).toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
      }

      // 셋의 세로 위치가 같아야 한 줄이다. 하나라도 아래로 밀리면 wrap 된 것이다.
      const tops = await row.locator("a").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      expect(new Set(tops).size, `버튼이 여러 줄로 나뉘었다 (top: ${tops.join(", ")})`).toBe(1);
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

      // RSVP 의 「신랑측 하객」 버튼과 겹치지 않도록 정확히 일치시킨다 (SIS-15).
      const groom = page.getByRole("button", { name: "신랑측", exact: true });
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

  // CM-07 색인 차단. 혼주 성함·예식장·계좌가 실린 페이지가 검색으로 찾아지면 안 된다.
  // 조용히 사라지기 쉬운 한 줄이라(빌드가 깨지지도, 화면이 달라지지도 않는다) 여기서 고정한다.
  test.describe("색인 차단", () => {
    test("robots 메타가 noindex 를 싣는다", async ({ page }) => {
      await page.goto("/");

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });

    test("robots.txt 가 크롤링을 막지 않는다", async ({ page }) => {
      // 막으면 크롤러가 noindex 를 읽지 못하고, 카카오톡 스크래퍼(SH-03)까지 함께 막힐 수 있다.
      // robots.txt 로 색인을 막으려는 「개선」이 들어오는 것을 여기서 잡는다.
      const res = await page.request.get("/robots.txt");
      expect(res.status()).toBe(200);

      const body = await res.text();
      // 주석에도 Disallow 라는 낱말이 나오므로 지시문 줄만 본다.
      const directives = body
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      expect(
        directives.some((line) => /^Disallow:\s*\/\s*$/i.test(line)),
        "robots.txt 가 전체를 막고 있다",
      ).toBe(false);
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

  // RS-01·RS-03 (SIS-15) + 전송(SIS-20).
  //
  // 컴포넌트 테스트(Rsvp.test.tsx)는 submitRsvp 자체를 mock 으로 덮으므로, supabase-js
  // 가 실제로 어떤 주소에 어떤 본문을 보내는지는 여기서만 드러난다. 응답만 스텁으로
  // 세우고 그 앞은 전부 진짜 코드가 돈다.
  test.describe("RSVP", () => {
    // 단계가 접혔다 펴지는 전환이 있어, 애니메이션을 끄고 최종 상태를 본다.
    test.use({ reducedMotion: "reduce" });

    test("여는 버튼을 눌러야 폼이 나온다", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "신랑측 하객" })).toBeHidden();

      await openRsvpForm(page);
      await expect(page.getByRole("button", { name: "신랑측 하객" })).toBeVisible();
    });

    // 여섯 칸을 한꺼번에 펼치면 카드가 화면 두 배가 된다. 한 번에 하나씩 묻는다.
    test("앞 항목을 채워야 다음 항목이 나타난다", async ({ page }) => {
      await page.goto("/");
      await openRsvpForm(page);
      await expect(page.getByRole("button", { name: "참석합니다" })).toBeHidden();

      await page.getByRole("button", { name: "신랑측 하객" }).click();
      await expect(page.getByRole("button", { name: "참석합니다" })).toBeVisible();
      await expect(page.getByLabel("성함")).toBeHidden();

      await page.getByRole("button", { name: "참석합니다" }).click();
      await expect(page.getByLabel("성함")).toBeVisible();
      await expect(page.getByLabel("참석 인원 (본인 포함)")).toBeHidden();

      await page.getByLabel("성함").fill("홍길동");
      await expect(page.getByLabel("참석 인원 (본인 포함)")).toBeVisible();
      await expect(page.getByLabel("연락처")).toBeHidden();

      await page.getByLabel("참석 인원 (본인 포함)").fill("2");
      await expect(page.getByLabel("연락처")).toBeVisible();
    });

    // 연락처가 필수로 돌아오면서(SIS-37) 미참석도 「채워야 다음이 나온다」를 따른다.
    test("미참석이면 성함 다음이 연락처고, 채워야 동의가 나온다", async ({ page }) => {
      await page.goto("/");
      await openRsvpForm(page);

      await page.getByRole("button", { name: "신부측 하객" }).click();
      await page.getByRole("button", { name: "참석 어려워요" }).click();
      await page.getByLabel("성함").fill("김하객");

      await expect(page.getByLabel("연락처")).toHaveValue("");
      await expect(page.getByRole("checkbox")).toBeHidden();

      await page.getByLabel("연락처").fill("000-0000-0000");
      await expect(page.getByRole("checkbox")).toBeVisible();
      await expect(page.getByLabel("참석 인원 (본인 포함)")).toBeHidden();
    });

    // 축의 대조·답례·회신 정정에 이 번호 말고는 창구가 없다 (SIS-37).
    test("미참석 회신도 연락처를 실어 나른다", async ({ page }) => {
      const sent = await stubRsvpInsert(page);
      await page.goto("/");
      await openRsvpForm(page);

      await page.getByRole("button", { name: "신부측 하객" }).click();
      await page.getByRole("button", { name: "참석 어려워요" }).click();
      await page.getByLabel("성함").fill("김하객");
      await page.getByLabel("연락처").fill("000-0000-0000");
      await page.getByRole("checkbox").check();

      // 미참석의 인원 1·식사안함은 DB 의 not null 을 채우려고 넣은 값이라 팝업에
      // 싣지 않는다 — 화면에서 확인한 것과 저장되는 것이 여기서만 갈린다.
      const dialog = await openRsvpConfirm(page);
      await expect(dialog.getByRole("term")).toHaveText(["하객 구분", "참석 여부", "성함", "연락처"]);
      await dialog.getByRole("button", { name: "확인" }).click();

      await expect(page.getByText(/참석 의사가 전달되었습니다/)).toBeVisible();
      expect(sent).toHaveLength(1);
      const row = Array.isArray(sent[0]) ? sent[0][0] : sent[0];
      expect(row).toMatchObject({ attend: "미참석", count: 1, meal: "식사안함", phone: "00000000000" });
    });

    test("동의 전에는 제출 버튼이 잠겨 있다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);

      const submit = page.getByRole("button", { name: "참석 의사 전하기" });
      await expect(submit).toBeDisabled();

      await page.getByRole("checkbox").check();
      await expect(submit).toBeEnabled();
    });

    // 제출 → 완료 카드 왕복 (SIS-20).
    test("참석 회신을 제출하면 저장 요청이 나가고 완료 카드로 바뀐다", async ({ page }) => {
      const sent = await stubRsvpInsert(page);
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("checkbox").check();
      const dialog = await openRsvpConfirm(page);
      // 팝업에 보인 값이 그대로 나간다. 연락처는 저장되는 모양(하이픈 없음)으로 보인다.
      await expect(dialog.getByText("00000000000")).toBeVisible();
      await dialog.getByRole("button", { name: "확인" }).click();

      await expect(page.getByText(/참석 의사가 전달되었습니다/)).toBeVisible();
      await expect(page.getByRole("button", { name: "참석 의사 전하기" })).toBeHidden();

      // 컬럼 대응이 어긋나면 DB 가 23514·PGRST204 로 거절하는데, 화면에는 원인이
      // 보이지 않는다. 나간 본문을 supabase/schema.sql 의 컬럼과 직접 맞춘다.
      expect(sent).toHaveLength(1);
      const row = Array.isArray(sent[0]) ? sent[0][0] : sent[0];
      expect(row).toEqual({
        side: "신랑측",
        attend: "참석",
        name: "홍길동",
        count: 2,
        meal: "식사함",
        // 하이픈은 폼이 걷어낸다 — 같은 번호가 두 모양으로 쌓이면 대조가 안 된다.
        phone: "00000000000",
      });

      // 중복 제출 방지는 localStorage 에 남는다. jsdom 이 아니라 진짜 브라우저에서
      // 새로고침을 넘겨 확인한다.
      await page.reload();
      await expect(page.getByText(/참석 의사가 전달되었습니다/)).toBeVisible();
      await expect(page.getByRole("button", { name: "참석 여부 알리기" })).toBeHidden();
    });

    // 실패를 삼키면 하객도 고객도 회신이 유실된 것을 알 수 없다 (SIS-33).
    test("저장이 실패하면 완료 카드로 넘어가지 않고 다시 시도할 수 있다", async ({ page }) => {
      await stubRsvpInsert(page, { status: 500 });
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("checkbox").check();
      const dialog = await openRsvpConfirm(page);
      await dialog.getByRole("button", { name: "확인" }).click();

      await expect(page.getByTestId("toast")).toContainText("실패");
      await expect(page.getByText(/참석 의사가 전달되었습니다/)).toBeHidden();
      // 팝업은 열린 채로 둔다 — 닫으면 여섯 항목을 처음부터 다시 확인해야 한다.
      // 토스트가 팝업 위(z-index 95 > 90)에 떠야 안내가 가려지지 않는다.
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "확인" })).toBeEnabled();
    });

    // 검증 시점이 「전송 직전」에서 「팝업 열기 직전」으로 옮겨 왔다 (SIS-36).
    test("검증에 걸리면 팝업이 뜨지 않고 한 줄로 알린다", async ({ page }) => {
      const sent = await stubRsvpInsert(page);
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByLabel("참석 인원 (본인 포함)").fill("0");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "참석 의사 전하기" }).click();

      await expect(page.getByTestId("toast")).toContainText("입력을 확인해 주세요");
      await expect(page.getByRole("dialog")).toBeHidden();
      // 무엇이 틀렸는지는 칸 옆의 인라인 오류가 말한다.
      await expect(page.getByText(/참석 인원은 1~20명/)).toBeVisible();
      await expect(page.getByLabel("참석 인원 (본인 포함)")).toBeFocused();
      expect(sent).toHaveLength(0);
    });

    // 틀린 값을 보고 되돌아왔는데 폼이 비어 있으면 여섯 항목을 다시 적어야 한다.
    test("팝업을 닫으면 폼이 채운 그대로 남는다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("checkbox").check();
      const dialog = await openRsvpConfirm(page);

      await dialog.getByRole("button", { name: "뒤로" }).click();

      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.getByLabel("성함")).toHaveValue("홍길동");
      await expect(page.getByLabel("연락처")).toHaveValue("000-0000-0000");
      await expect(page.getByRole("checkbox")).toBeChecked();
      // 닫으면 눌렀던 버튼으로 초점이 돌아온다 — 키보드로 훑던 사람이 폼을 다시
      // 찾아 내려오지 않아도 된다.
      await expect(page.getByRole("button", { name: "참석 의사 전하기" })).toBeFocused();
    });

    // 여러 명이 와도 번호는 하나만 받는다. 미참석은 인원 개념이 없어 붙이지 않는다.
    test("연락처 안내는 참석에만 붙고 형식 예시는 그대로 남는다", async ({ page }) => {
      await page.goto("/");
      await openRsvpForm(page);
      await page.getByRole("button", { name: "신랑측 하객" }).click();
      await page.getByRole("button", { name: "참석합니다" }).click();
      await page.getByLabel("성함").fill("홍길동");
      await page.getByLabel("참석 인원 (본인 포함)").fill("2");

      await expect(page.getByText(/대표 한 분의 연락처만 남겨주세요/)).toBeVisible();
      // 하이픈 없이 적어도 된다는 정보가 안내에 밀려 사라지면 안 된다.
      await expect(page.getByLabel("연락처")).toHaveAttribute("placeholder", /^ex\)/);

      await page.getByRole("button", { name: "참석 어려워요" }).click();
      await expect(page.getByText(/대표 한 분의 연락처만 남겨주세요/)).toBeHidden();
    });

    // 고지한 수집 항목이 실제 수집과 어긋나면 고지가 효력을 잃는다(RS-03).
    test("개인정보 처리방침 전문을 펼쳐 볼 수 있다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);
      await expect(page.getByText("개인정보 처리방침", { exact: true })).toBeHidden();

      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();
      await expect(page.getByText("개인정보 처리방침", { exact: true })).toBeVisible();
      await expect(page.getByText(/데이터 저장 리전/)).toBeVisible();
    });

    // 페이드의 끝색은 --surface-3 의 알파 0 을 값으로 직접 적어 둔 것이다(global.css).
    // 토큰만 바꾸면 시작색은 따라오고 끝색은 옛 색으로 남아, 잘린 자리에 탁한 띠가
    // 생긴다. 눈으로는 알아채기 어려운 종류라 여기서 두 색이 같은지 직접 잰다.
    test("페이드 끝색이 안내 박스 배경과 같다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();

      const measured = await page.locator(".privacy-policy-wrap").evaluate((el) => {
        const gradient = getComputedStyle(el, "::after").backgroundImage;
        // 그라데이션 안의 rgb·rgba 를 순서대로 뽑는다. 시작색은 토큰, 끝색은 하드코딩이다.
        const stops = gradient.match(/rgba?\([^)]*\)/g) ?? [];
        const rgb = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).join(",");
        return { stops: stops.length, first: rgb(stops[0] ?? ""), last: rgb(stops.at(-1) ?? "") };
      });

      expect(measured.stops, "그라데이션에서 색을 읽지 못했다").toBe(2);
      expect(measured.last, "페이드 끝색이 --surface-3 와 어긋났다").toBe(measured.first);
    });

    // 9개 항목을 그대로 펼치면 카드가 화면 몇 배로 늘어난다. 안쪽에서만 스크롤해
    // 폼과 다음 섹션의 자리가 흔들리지 않아야 한다.
    test("전문은 카드를 늘리지 않고 자체 높이 안에서 스크롤한다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);

      const card = page.locator(".card").filter({ hasText: "개인정보 수집·이용 안내" });
      const before = (await card.boundingBox())?.height ?? 0;

      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();
      const panel = page.getByRole("region", { name: "개인정보 처리방침" });
      await expect(panel).toBeVisible();

      // 내용이 영역보다 길어야 스크롤이 의미가 있다.
      const { clientHeight, scrollHeight } = await panel.evaluate((el) => ({
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }));
      expect(scrollHeight).toBeGreaterThan(clientHeight);

      // 카드가 늘어나는 폭은 접힌 영역의 높이까지다. 전문 전체 길이만큼 늘면 안 된다.
      const after = (await card.boundingBox())?.height ?? 0;
      expect(after - before).toBeLessThan(scrollHeight);
    });
  });

  // 페이드인이 진행 중이면 axe가 합성된 중간 색상을 읽어 색상 대비를 오탐한다.
  // reduced-motion으로 애니메이션을 건너뛰어 최종 상태를 검사하고,
  // 동시에 prefers-reduced-motion 대응(MotionConfig reducedMotion="user")도 함께 검증한다.
  test.describe("접근성", () => {
    test.use({ reducedMotion: "reduce" });

    // 토큰 조합의 대비를 axe 와 별개로 직접 잰다(SIS-18).
    //
    // **axe 만으로는 새는 자리가 있다.** color-contrast 규칙을 켠 뒤에도 D-Day 「초」 라벨의
    // 3.87:1 이 통과했는데, axe 가 배경을 확정하지 못한 노드를 violation 이 아니라
    // `incomplete`(판정 불가) 로 빼기 때문이다. 겹친 요소·배경 사진·반투명 조상이 있으면
    // 그렇게 되고, 사진 위에 글씨가 얹히는 화면이 이 청첩장에는 여럿이다.
    //
    // 값은 실제로 그려진 페이지에서 읽는다. tokens.css 를 파싱하면 그 파일이 로드되지
    // 않았거나 다른 규칙이 덮어쓴 경우를 못 본다. (Vitest 유닛으로 두려 했으나 ?raw 가
    // CSS 를 빈 문자열로 돌려주고, node:fs 는 @types/node 가 필요해 여기로 옮겼다.)
    test("색상 토큰 조합이 WCAG AA 를 넘는다", async ({ page }) => {
      await page.goto("/");

      /** 작은 글씨 4.5:1 / 큰 글씨(24px 이상, 18.66px 이상 굵게) 3:1. */
      const SMALL = 4.5;
      const LARGE = 3;

      // 기준은 그 조합이 **실제로 쓰이는 가장 작은 크기**로 정한다. 같은 토큰이라도 배경이
      // 다르면 크기가 다르다 — --primary 는 --bg 위에서는 커버 30px·푸터 34px 뿐이지만
      // 카드 위에서는 교통 안내 라벨 12.5px 로 내려온다.
      // 조합을 더할 때는 그 자리의 글자 크기를 확인하고 기준을 고른다.
      const pairs: [fg: string, bg: string, min: number, where: string][] = [
        ["--text", "--bg", SMALL, "제목"],
        ["--text", "--card", SMALL, "카드 제목·계좌 예금주"],
        ["--text-body", "--bg", SMALL, "본문"],
        ["--text-body", "--card", SMALL, "달력 날짜·인사말"],
        ["--text-sub", "--bg", SMALL, "커버 일시·장소 14px"],
        ["--text-sub", "--card", SMALL, "예식장·주소·계좌·인용 출처 12.5~15px"],
        ["--text-sub", "--surface-3", SMALL, "인사말 카드의 강조 배경 12.5px"],
        ["--muted", "--bg", SMALL, "커버 날짜 캡션 11px·푸터 날짜 12px"],
        ["--muted", "--card", SMALL, "갤러리 안내 문구 12.5px"],
        ["--muted-2", "--surface", SMALL, "D-Day 일·시·분 라벨 10.5px"],
        ["--muted-2", "--card", SMALL, "갤러리 카운터 18px·연락처 안내 문구 12.5px"],
        ["--muted", "--surface-3", SMALL, "확인 팝업 항목 라벨 13px"],
        ["--primary", "--bg", LARGE, "커버 30px·푸터 34px — 전부 큰 글씨"],
        ["--primary", "--card", SMALL, "교통 안내 라벨 12.5px·혼주 관계 13px·D-Day 일수 14px 굵게"],
        ["--on-surface", "--surface-2", SMALL, "공유 버튼 13px"],
        ["--on-surface", "--surface", SMALL, "RSVP 미선택 버튼 14px·잠긴 제출 버튼 15px"],
        ["--on-surface", "--surface-3", SMALL, "개인정보 처리방침 펼치기 12.5px"],
        ["--text", "--surface-3", SMALL, "개인정보 안내 제목 13.5px·동의 문구 13px·확인 팝업 항목 값 14px"],
        // 새로 들인 오류색 (SIS-36). 카드 위 5.96:1 로, 그전까지 오류를 표시하던
        // --primary(4.81)보다 여유가 있다.
        ["--error", "--card", SMALL, "오류 메시지 12.5px·오류 칸 테두리·초점 링"],
        ["--on-primary", "--primary", SMALL, "달력 예식일 원 14.5px 굵게·지도 앱 버튼 13px"],
        ["--on-primary-sub", "--primary", SMALL, "D-Day 「초」 라벨 10.5px"],
        ["--on-primary-title", "--primary", SMALL, "그린 배경 위 제목"],
      ];

      const measured = await page.evaluate((combos) => {
        const root = getComputedStyle(document.documentElement);
        const rgb = (token: string) => {
          const hex = root.getPropertyValue(token).trim();
          const m = /^#([0-9a-f]{6})$/i.exec(hex);
          return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
        };
        const luminance = (c: number[]) => {
          const ch = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
        };

        return combos.map(([fg, bg, min, where]) => {
          const [f, b] = [rgb(fg), rgb(bg)];
          if (!f || !b) return `${fg} on ${bg} — 토큰을 읽지 못했다 (${where})`;
          const [hi, lo] = [luminance(f), luminance(b)].sort((x, y) => y - x);
          const ratio = (hi + 0.05) / (lo + 0.05);
          return ratio >= min ? null : `${fg} on ${bg} = ${ratio.toFixed(2)}:1 (${min} 필요) — ${where}`;
        });
      }, pairs);

      expect(measured.filter(Boolean)).toEqual([]);
    });

    test("critical/serious 위반이 없다", async ({ page }) => {
      await page.goto("/");
      // 색상 대비 판정은 스타일·폰트가 적용되고 화면이 자리를 잡은 뒤라야 의미가 있다.
      // 커버 자체의 페이드인은 로딩 화면이 걷히는 연출로 옮겨져 사라졌지만(Cover.tsx),
      // 로딩 오버레이가 남아 있는 동안 감사하면 그 아래가 통째로 가려진다. opacity 가
      // 1인 것을 확인하는 것으로 오버레이가 걷혔음까지 함께 본다.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // 기본 5초를 쓰지 않는 이유는 커버 패럴랙스 쪽 scrollPastCover 의 주석 참고 —
      // CI 에서 로딩은 늘 상한 4초를 채우므로 여유가 1초도 남지 않는다.
      await expect(page.getByTestId("loading")).toBeHidden({ timeout: 15_000 });
      await expect(page.locator("header")).toHaveCSS("opacity", "1");

      // 아코디언은 기본이 접힘이고 닫힌 패널은 DOM 에서 빠진다. 열어 두지 않으면 계좌 행과
      // 복사 버튼이 감사 대상에 아예 없어, 그 안의 위반은 CI 가 영영 보지 못한다.
      // 이름을 정확히 맞춘다 — RSVP 의 「신랑측 하객」이 앞자리를 공유한다 (SIS-15).
      for (const label of ["신랑측", "신부측"]) {
        await page.getByRole("button", { name: label, exact: true }).click();
      }
      await expect(page.getByRole("button", { name: /계좌번호 복사$/ }).first()).toBeVisible();

      // 처리방침 전문도 접힌 채로는 감사되지 않는다. 문단·목록이 많아 대비 위반이
      // 숨기 쉬운 자리라, 폼을 동의 단계까지 채워 펼쳐 두고 검사한다 (RS-03).
      await fillRsvpToConsent(page);
      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();

      await expect(page.getByRole("button", { name: "카카오톡으로 공유" })).toBeVisible();

      // **리빌이 전부 끝나기를 기다린다.** 색상 대비를 검사하는 이상 이것이 필수다 —
      // Reveal 은 whileInView 라 그 자리까지 내려가야 시작하고, MotionConfig 의
      // reducedMotion 은 transform 만 줄이고 opacity 페이드는 남긴다(Motion 사양).
      // 페이드 도중에 감사하면 axe 가 섹션의 반투명이 합성된 중간 색을 읽어
      // (예: --primary #667662 를 옅은 회록으로) 색상 대비를 통째로 오탐한다.
      //
      // 한 번에 맨 아래로 뛰면 중간 섹션이 관찰되지 않아 opacity 0 인 채 남는다. 훑어 내려간다.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.6) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      });
      // 리빌 대상은 Reveal 이 그리는 <section> 뿐이라 그것만 본다. 인라인 opacity 를 통째로
      // 훑으면 갤러리의 잠긴 화살표(0.35)와 커버의 「scroll ↓」(무한 왕복)에 영영 걸린다.
      //
      // 기본 5초로는 모자란다. 마지막 섹션들은 훑기가 끝날 무렵에야 뷰에 들어와 그때부터
      // 0.9초 페이드를 시작하고, 워커들이 CPU 를 나눠 쓰면 그 페이드들이 서로 밀린다 —
      // ios-safari 에서 「3개가 아직 1이 아니다」로 흔들렸다(2026-08-18). 조건 대기라
      // 정상일 때는 곧바로 풀리고, 늘린 시간을 실제로 쓰지 않는다.
      await expect
        .poll(
          () =>
            page.evaluate(
              () => [...document.querySelectorAll("section")].filter((el) => getComputedStyle(el).opacity !== "1").length,
            ),
          { timeout: 20_000 },
        )
        .toBe(0);

      // color-contrast 를 제외하지 않는다(SIS-18). --muted·--muted-2·--text-sub 가
      // AA 에 미달해 오래 빼 두었던 규칙이며, 2026-08-13 고객 승인으로 --primary 까지
      // 4.5:1 위로 올려 되살렸다. 다시 제외하는 변경이 들어오면 그때는 근거가 필요하다.
      //
      // **다만 이 검사만 믿으면 안 된다.** 아래는 violations 만 보는데, axe 는 배경을
      // 확정하지 못한 노드를 violation 이 아니라 incomplete 로 빼 조용히 통과시킨다 —
      // 실제로 D-Day 「초」 라벨의 3.87:1 이 그렇게 빠져나갔다. 토큰 조합 자체는
      // 바로 위 「색상 토큰 조합이 WCAG AA 를 넘는다」가 따로 지킨다.
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      // 위반 객체를 통째로 비교하면 실패 출력이 노드 하나에 수십 줄이라 무엇이 걸렸는지 안 보인다.
      // 규칙·요소·사유 한 줄로 눌러서 비교한다.
      const blocking = results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .flatMap((v) =>
          v.nodes.map((n) => `${v.id} · ${n.target.join(" ")} · ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
        );
      expect(blocking).toEqual([]);
    });

    // 확인 팝업은 버튼 뒤에 있어 위 감사가 닿지 못한다. 페이지 전체를 다시 훑는 대신
    // 팝업만 범위로 잡는다 — 열면 오버레이가 화면을 덮어, 같이 감사하면 뒤쪽 요소의
    // 판정이 이 팝업과 무관하게 흔들린다 (SIS-36).
    test("확인 팝업에 critical/serious 위반이 없다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("checkbox").check();
      await openRsvpConfirm(page);

      const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .flatMap((v) =>
          v.nodes.map((n) => `${v.id} · ${n.target.join(" ")} · ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
        );
      expect(blocking).toEqual([]);
    });

    test("모션을 줄인 설정에서도 콘텐츠가 보인다", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Thank you")).toBeVisible();
    });
  });
});
