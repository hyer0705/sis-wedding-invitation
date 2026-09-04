import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { INVITE } from "../src/invite";

async function openRsvpForm(page: Page) {
  const opener = page.getByRole("button", { name: "참석 여부 알리기" });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await expect(page.getByRole("button", { name: "신랑측 하객" })).toBeVisible();
}

async function stubRsvpInsert(page: Page, { status = 201 } = {}) {
  const sent: unknown[] = [];

  await page.route("**/rest/v1/rsvp*", async (route) => {
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
      body: status < 400 ? "" : JSON.stringify({ code: "23514", message: "check 제약 위반", details: "", hint: "" }),
    });
  });

  return sent;
}

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

async function openRsvpConfirm(page: Page) {
  await page.getByRole("button", { name: "참석 의사 전하기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator(".rsvp-confirm-overlay")).toHaveCSS("opacity", "1");
  return dialog;
}

test.describe("청첩장 기본 동작", () => {
  test("페이지가 열리고 신랑·신부 이름과 예식 일시가 보인다", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(INVITE.dateText)).toBeVisible();
  });

  const OFFLINE_HOST = "rsvp-e2e.invalid";
  const isExpectedOfflineFailure = (msg: ConsoleMessage) =>
    msg.text().includes(OFFLINE_HOST) || msg.location().url.includes(OFFLINE_HOST);

  test("커버부터 푸터까지 스크롤하는 동안 콘솔 에러가 없다", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isExpectedOfflineFailure(msg)) errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      if (!err.message.includes(OFFLINE_HOST)) errors.push(err.message);
    });

    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  test("예식 일시가 날짜·시각 덩어리째로만 줄바꿈된다", async ({ page }) => {
    await page.goto("/");

    for (const part of [INVITE.dateText, INVITE.dayText]) {
      const chunk = page.getByText(part, { exact: true });
      const { height, fontSize } = await chunk.evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      }));

      expect(height, `"${part}" 이 두 줄로 쪼개졌다`).toBeLessThan(fontSize * 2);
    }
  });

  test("인사말이 고객이 지정한 줄바꿈대로 앉는다", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 375, "320px 은 읽을 수 있는 크기로 지킬 수 없다");
    await page.goto("/");

    await page.evaluate(() => document.fonts.ready);
    const fontReady = await page.evaluate(() => document.fonts.check("14.5px 'Nanum Myeongjo'"));
    test.skip(!fontReady, "본문 웹폰트를 받지 못했다 — 폴백 폰트로는 줄 수를 잴 수 없다");

    for (const block of INVITE.greeting.body) {
      const authored = block.split("\n").length;
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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test.describe("태블릿·PC", () => {
    const WIDE = { width: 1280, height: 900 };

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

    test("로딩 화면이 컬럼 밖까지 덮지 않는다", async ({ page }) => {
      await page.route(/1_main-\d+\.webp/, () => new Promise(() => {}));
      await page.setViewportSize(WIDE);
      await page.goto("/", { waitUntil: "commit" });

      await expect(page.getByTestId("loading")).toBeVisible();

      const { width, left, right } = await column(page, '[data-testid="loading"]');
      expect(width).toBe(430);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    });

    test("부트 화면이 컬럼 밖까지 덮지 않는다", async ({ page }) => {
      await page.route(/assets\/.*\.js$/, (route) => route.abort());
      await page.setViewportSize(WIDE);
      await page.goto("/", { waitUntil: "commit" });

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

  test.describe("커버 패럴랙스", () => {
    const coverTransform = (page: Page) => page.locator("header img").evaluate((el) => getComputedStyle(el).transform);

    async function scrollPastCover(page: Page) {
      await expect(page.getByTestId("loading")).toBeHidden({ timeout: 15_000 });
      const before = await coverTransform(page);

      await page.evaluate(() => window.scrollTo(0, 400));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

      return before;
    }

    test("스크롤하면 커버 사진이 따라 내려온다", async ({ page }) => {
      await page.goto("/");
      const before = await scrollPastCover(page);

      await expect.poll(() => coverTransform(page), { timeout: 10_000 }).not.toBe(before);
    });

    test("모션을 줄인 설정에서는 사진이 움직이지 않는다", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const before = await scrollPastCover(page);

      await page.waitForTimeout(300);
      expect(await coverTransform(page)).toBe(before);
    });
  });

  test.describe("초대글", () => {
    const nameLefts = async (page: Page) => {
      const blocks = page.locator(".parent-names");
      const counts = await blocks.count();

      const lefts: number[][] = [];
      for (let index = 0; index < counts; index += 1) {
        lefts.push(
          await blocks
            .nth(index)
            .locator(".parent-name")
            .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left))),
        );
      }
      return lefts;
    };

    test("IN-04 혼주 성함이 故 표시에 밀리지 않고 한쪽 안에서 같은 자리에 선다", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);

      const lefts = await nameLefts(page);

      expect(lefts.map((side) => side.length)).toEqual([INVITE.groom.parents.length, INVITE.bride.parents.length]);
      for (const side of lefts) {
        expect(new Set(side).size, `혼주 성함 시작점이 어긋났다 (left: ${side.join(", ")})`).toBe(1);
      }
    });

    test("IN-04 큰 글씨에서도 혼주 성함 시작점이 어긋나지 않는다", async ({ page }) => {
      await page.goto("/");
      await page.locator(".text-size-bar-button").click();
      await page.evaluate(() => document.fonts.ready);

      for (const side of await nameLefts(page)) {
        expect(new Set(side).size, `큰 글씨에서 혼주 성함 시작점이 어긋났다 (left: ${side.join(", ")})`).toBe(1);
      }
    });
  });

  test.describe("갤러리 슬라이드", () => {
    const track = (page: Page) => page.getByRole("group", { name: "웨딩 사진 갤러리" });
    const counter = (page: Page) => page.getByTestId("gallery-counter");

    test("스크롤해서 넘기면 현재 위치 표시가 따라온다", async ({ page }) => {
      await page.goto("/");
      await track(page).scrollIntoViewIfNeeded();
      await expect(counter(page)).toHaveText(`1 / ${INVITE.gallery.length}`);

      await track(page).evaluate((el) => {
        const step = (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
        el.scrollTo({ left: step * 3, behavior: "auto" });
      });

      await expect(counter(page)).toHaveText(`4 / ${INVITE.gallery.length}`);
    });

    test("GL-04 커버가 받을 동안 사진이 순서를 양보한다", async ({ page }) => {
      await page.goto("/");
      const first = track(page).locator("img").first();

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

  test.describe("오시는 길", () => {
    test("지도 앱 세 곳 링크가 예식장 좌표를 싣는다", async ({ page }) => {
      await page.goto("/");

      for (const label of ["네이버지도", "카카오맵", "티맵"]) {
        await expect(page.getByRole("link", { name: label })).toHaveAttribute("href", /^https:\/\//);
      }

      const kakao = await page.getByRole("link", { name: "카카오맵" }).getAttribute("href");
      expect(decodeURIComponent(kakao ?? "")).toContain(`${INVITE.coords.lat},${INVITE.coords.lng}`);
    });

    test("지도 앱 버튼 3개가 한 줄에 앉고 라벨이 접히지 않는다", async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => document.fonts.ready);

      const row = page.locator(".map-links");
      const rowBox = await row.boundingBox();
      expect(rowBox).not.toBeNull();

      for (const label of ["네이버지도", "카카오맵", "티맵"]) {
        const link = page.getByRole("link", { name: label });

        const lines = await link.evaluate((el) => {
          const textNode = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
          if (!textNode) return 0;
          const range = document.createRange();
          range.selectNodeContents(textNode);
          return range.getClientRects().length;
        });
        expect(lines, `"${label}" 라벨이 ${lines}줄로 접혔다`).toBe(1);

        const box = await link.boundingBox();
        expect(box).not.toBeNull();
        expect(box.x, `"${label}" 버튼이 왼쪽으로 삐져나왔다`).toBeGreaterThanOrEqual(rowBox.x - 0.5);
        expect(box.x + box.width, `"${label}" 버튼이 오른쪽으로 삐져나왔다`).toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
      }

      const tops = await row.locator("a").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      expect(new Set(tops).size, `버튼이 여러 줄로 나뉘었다 (top: ${tops.join(", ")})`).toBe(1);
    });

    test("주소 복사 버튼이 실제 클립보드에 주소를 넣는다", async ({ page, context, browserName }) => {
      test.skip(browserName !== "chromium", "clipboard-read 권한은 chromium 전용");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/");

      await page.getByRole("button", { name: "주소 복사하기" }).click();

      await expect(page.getByTestId("toast")).toHaveText("주소가 복사되었습니다");
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toBe(INVITE.address);
    });
  });

  test.describe("예식 안내", () => {
    test("안내 문구가 오시는 길과 RSVP 사이에 선다", async ({ page }) => {
      await page.goto("/");

      const notice = page.getByTestId("notice");
      for (const lines of INVITE.notices) {
        await expect(notice).toContainText(lines.join(" "));
      }

      const order = await page.evaluate(() => {
        const notice = document.querySelector('[data-testid="notice"]');
        const map = document.querySelector('[data-testid="venue-map"]');
        const rsvp = [...document.querySelectorAll(".script-title")].find((el) => el.textContent === "R.S.V.P");
        if (!notice || !map || !rsvp) return null;

        const precedes = (first: Element, second: Element) =>
          Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

        return { 오시는길다음: precedes(map, notice), RSVP앞: precedes(notice, rsvp) };
      });

      expect(order).toEqual({ 오시는길다음: true, RSVP앞: true });
    });

    test("큰 글씨에서는 고객이 정한 자리에서 줄을 바꾼다", async ({ page }) => {
      await page.goto("/");
      await page.locator(".text-size-bar-button").click();
      await page.getByTestId("notice").scrollIntoViewIfNeeded();

      const tops = await page
        .locator('[data-testid="notice"] .notice-line')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));

      expect(tops).toHaveLength(INVITE.notices.flat().length);
      expect(new Set(tops).size, `조각이 같은 줄에 겹쳤다 (top: ${tops.join(", ")})`).toBe(tops.length);
    });
  });

  test.describe("마음 전하실 곳", () => {
    test("아코디언을 열면 계좌가 나오고 복사가 실제 클립보드에 들어간다", async ({ page, context, browserName }) => {
      test.skip(browserName !== "chromium", "clipboard-read 권한은 chromium 전용");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/");

      const groom = page.getByRole("button", { name: "신랑측", exact: true });
      await groom.click();

      await expect(page.getByRole("button", { name: /계좌번호 복사$/ })).toHaveCount(2);

      await page
        .getByRole("button", { name: /계좌번호 복사$/ })
        .first()
        .click();

      await expect(page.getByTestId("toast")).toHaveText("계좌번호가 복사되었습니다");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("111-111-111111");
    });
  });

  test.describe("공유", () => {
    test("공유 버튼 두 개가 푸터 위에 있다", async ({ page }) => {
      await page.goto("/");

      const share = page.getByRole("region", { name: "청첩장 공유" });
      await expect(share.getByRole("button", { name: "카카오톡으로 공유" })).toBeVisible();
      await expect(share.getByRole("button", { name: "링크 복사" })).toBeVisible();

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
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(INVITE.siteUrl);
    });

    test("kakao SDK 가 처음 받는 HTML 에 실려 오지 않는다", async ({ page }) => {
      const html = await (await page.request.get("/")).text();

      expect(html).not.toContain("kakao_js_sdk");
    });

    test("OG 태그가 INVITE.share 문구를 그대로 싣는다", async ({ page }) => {
      await page.goto("/");

      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", INVITE.share.title);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", INVITE.share.description);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", INVITE.siteUrl);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/.+\/og-image\.jpg$/);
    });
  });

  test.describe("색인 차단", () => {
    test("robots 메타가 noindex 를 싣는다", async ({ page }) => {
      await page.goto("/");

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });

    test("robots.txt 가 크롤링을 막지 않는다", async ({ page }) => {
      const res = await page.request.get("/robots.txt");
      expect(res.status()).toBe(200);

      const body = await res.text();
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

  test.describe("로딩 화면", () => {
    const COVER_REQUEST = /1_main-\d+\.webp/;
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

    test("커버 사진이 오지 않아도 상한에서 걷힌다", async ({ page }) => {
      await page.route(COVER_REQUEST, () => new Promise(() => {}));

      await page.goto("/", { waitUntil: "commit" });

      await expect(loadingOf(page)).toBeVisible();
      await expect(loadingOf(page)).toBeHidden({ timeout: 8000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });

  test.describe("스켈레톤 shimmer", () => {
    const COVER_REQUEST = /1_main-\d+\.webp/;
    const frame = (page: Page) => page.getByTestId("cover-frame");

    const shimmering = (page: Page) =>
      frame(page).evaluate((el) =>
        el.getAnimations({ subtree: true }).some((a) => (a as CSSAnimation).animationName === "skeleton-shimmer"),
      );

    const countsAnimations = (browserName: string) =>
      test.skip(browserName !== "chromium", "의사요소 애니메이션 계수는 chromium 에서만 신뢰할 수 있다");

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
      await page.emulateMedia({ reducedMotion: "reduce" });
      await holdCover(page);
      await page.goto("/", { waitUntil: "commit" });

      await expect(frame(page)).toHaveClass(/skeleton/);
      await expect(frame(page)).toHaveCSS("background-color", "rgb(242, 244, 236)");

      countsAnimations(browserName);
      expect(await shimmering(page)).toBe(false);
    });

    test("사진이 도착하면 광택을 걷는다", async ({ page, browserName }) => {
      await page.goto("/");

      await expect(frame(page)).toHaveClass(/is-loaded/);
      await expect(page.locator("header img")).toHaveCSS("opacity", "1");

      countsAnimations(browserName);
      expect(await shimmering(page)).toBe(false);
    });

    test("갤러리는 사진이 도착한 자리의 면을 걷는다", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("group", { name: "웨딩 사진 갤러리" }).scrollIntoViewIfNeeded();

      const first = page.getByTestId("gallery-slot").first();
      await expect(first).not.toHaveClass(/skeleton/);
      await expect(first.locator("img")).toHaveCSS("opacity", "1");
    });
  });

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

      expect(
        fontResponses.filter((r) => /gstatic\.com.*parisienne/i.test(r.url)),
        "Parisienne 이 Google Fonts 에서도 온다 — index.html 의 css2 요청에서 빼야 한다",
      ).toHaveLength(0);

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

  test.describe("RSVP", () => {
    test.use({ reducedMotion: "reduce" });

    test("여는 버튼을 눌러야 폼이 나온다", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "신랑측 하객" })).toBeHidden();

      await openRsvpForm(page);
      await expect(page.getByRole("button", { name: "신랑측 하객" })).toBeVisible();
    });

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

    test("미참석 회신도 연락처를 실어 나른다", async ({ page }) => {
      const sent = await stubRsvpInsert(page);
      await page.goto("/");
      await openRsvpForm(page);

      await page.getByRole("button", { name: "신부측 하객" }).click();
      await page.getByRole("button", { name: "참석 어려워요" }).click();
      await page.getByLabel("성함").fill("김하객");
      await page.getByLabel("연락처").fill("000-0000-0000");
      await page.getByRole("checkbox").check();

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

    test("참석 회신을 제출하면 저장 요청이 나가고 완료 카드로 바뀐다", async ({ page }) => {
      const sent = await stubRsvpInsert(page);
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("checkbox").check();
      const dialog = await openRsvpConfirm(page);
      await expect(dialog.getByText("00000000000")).toBeVisible();
      await dialog.getByRole("button", { name: "확인" }).click();

      await expect(page.getByText(/참석 의사가 전달되었습니다/)).toBeVisible();
      await expect(page.getByRole("button", { name: "참석 의사 전하기" })).toBeHidden();

      expect(sent).toHaveLength(1);
      const row = Array.isArray(sent[0]) ? sent[0][0] : sent[0];
      expect(row).toEqual({
        side: "신랑측",
        attend: "참석",
        name: "홍길동",
        count: 2,
        meal: "식사함",
        phone: "00000000000",
      });

      await page.reload();
      await expect(page.getByText(/참석 의사가 전달되었습니다/)).toBeVisible();
      await expect(page.getByRole("button", { name: "참석 여부 알리기" })).toBeHidden();
    });

    test("저장이 실패하면 완료 카드로 넘어가지 않고 다시 시도할 수 있다", async ({ page }) => {
      await stubRsvpInsert(page, { status: 500 });
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("checkbox").check();
      const dialog = await openRsvpConfirm(page);
      await dialog.getByRole("button", { name: "확인" }).click();

      await expect(page.getByTestId("toast")).toContainText("실패");
      await expect(page.getByText(/참석 의사가 전달되었습니다/)).toBeHidden();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "확인" })).toBeEnabled();
    });

    test("검증에 걸리면 팝업이 뜨지 않고 한 줄로 알린다", async ({ page }) => {
      const sent = await stubRsvpInsert(page);
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByLabel("참석 인원 (본인 포함)").fill("0");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "참석 의사 전하기" }).click();

      await expect(page.getByTestId("toast")).toContainText("입력을 확인해 주세요");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.getByText(/참석 인원은 1~20명/)).toBeVisible();
      await expect(page.getByLabel("참석 인원 (본인 포함)")).toBeFocused();
      expect(sent).toHaveLength(0);
    });

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
      await expect(page.getByRole("button", { name: "참석 의사 전하기" })).toBeFocused();
    });

    test("연락처 안내는 참석에만 붙고 형식 예시는 그대로 남는다", async ({ page }) => {
      await page.goto("/");
      await openRsvpForm(page);
      await page.getByRole("button", { name: "신랑측 하객" }).click();
      await page.getByRole("button", { name: "참석합니다" }).click();
      await page.getByLabel("성함").fill("홍길동");
      await page.getByLabel("참석 인원 (본인 포함)").fill("2");

      await expect(page.getByText(/대표 한 분의 연락처만 남겨주세요/)).toBeVisible();
      await expect(page.getByLabel("연락처")).toHaveAttribute("placeholder", /^ex\)/);

      await page.getByRole("button", { name: "참석 어려워요" }).click();
      await expect(page.getByText(/대표 한 분의 연락처만 남겨주세요/)).toBeHidden();
    });

    test("개인정보 처리방침 전문을 펼쳐 볼 수 있다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);
      await expect(page.getByText("개인정보 처리방침", { exact: true })).toBeHidden();

      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();
      await expect(page.getByText("개인정보 처리방침", { exact: true })).toBeVisible();
      await expect(page.getByText(/데이터 저장 리전/)).toBeVisible();
    });

    test("페이드 끝색이 안내 박스 배경과 같다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);
      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();

      const measured = await page.locator(".privacy-policy-wrap").evaluate((el) => {
        const gradient = getComputedStyle(el, "::after").backgroundImage;
        const stops = gradient.match(/rgba?\([^)]*\)/g) ?? [];
        const rgb = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).join(",");
        return { stops: stops.length, first: rgb(stops[0] ?? ""), last: rgb(stops.at(-1) ?? "") };
      });

      expect(measured.stops, "그라데이션에서 색을 읽지 못했다").toBe(2);
      expect(measured.last, "페이드 끝색이 --surface-3 와 어긋났다").toBe(measured.first);
    });

    test("전문은 카드를 늘리지 않고 자체 높이 안에서 스크롤한다", async ({ page }) => {
      await page.goto("/");
      await fillRsvpToConsent(page);

      const card = page.locator(".card").filter({ hasText: "개인정보 수집·이용 안내" });
      const before = (await card.boundingBox())?.height ?? 0;

      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();
      const panel = page.getByRole("region", { name: "개인정보 처리방침" });
      await expect(panel).toBeVisible();

      const { clientHeight, scrollHeight } = await panel.evaluate((el) => ({
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }));
      expect(scrollHeight).toBeGreaterThan(clientHeight);

      const after = (await card.boundingBox())?.height ?? 0;
      expect(after - before).toBeLessThan(scrollHeight);
    });
  });

  test.describe("배경음악", () => {
    test("자동으로 재생하지 않는다", async ({ page }) => {
      await page.goto("/");

      await expect(page.getByRole("button", { name: "배경음악" })).toHaveAttribute("aria-pressed", "false");

      const state = await page.evaluate(() => {
        const audio = document.querySelector("audio");
        return audio ? { paused: audio.paused, muted: audio.muted, preload: audio.preload, loop: audio.loop } : null;
      });
      expect(state).toEqual({ paused: true, muted: true, preload: "none", loop: true });
    });

    test("아래로 스크롤해도 토글이 화면에 남는다", async ({ page }) => {
      await page.goto("/");

      const toggle = page.getByRole("button", { name: "배경음악" });
      await expect(toggle).toBeInViewport();

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(toggle).toBeInViewport();
    });
  });

  test.describe("큰 글씨로 보기", () => {
    const bodyText = (page: Page) => page.getByText(INVITE.greeting.body[0].split("\n")[0].trim());

    async function fontSize(page: Page) {
      return page.evaluate(() => {
        const paragraph = document.querySelector(".card p");
        return paragraph ? parseFloat(getComputedStyle(paragraph).fontSize) : 0;
      });
    }

    test("바를 누르면 본문 글자가 실제로 커진다", async ({ page }) => {
      await page.goto("/");
      await bodyText(page).scrollIntoViewIfNeeded();

      const before = await fontSize(page);
      await page.locator(".text-size-bar-button").click();
      const after = await fontSize(page);

      expect(after).toBeGreaterThan(before);
      await expect(page.getByRole("button", { name: /글씨 원래대로/ })).toBeVisible();
    });

    test("큰 글씨에서도 카드 밖으로 밀려나는 것이 없다", async ({ page }) => {
      await page.goto("/");
      await page.locator(".text-size-bar-button").click();
      await page.locator(".map-links").scrollIntoViewIfNeeded();

      const bleeding = await page.evaluate(() =>
        [...document.querySelectorAll(".card")].flatMap((card) => {
          const limit = card.getBoundingClientRect().right + 0.5;
          return [...card.querySelectorAll("*")]
            .filter((el) => el.getBoundingClientRect().right > limit)
            .map((el) => `${el.tagName}.${el.className}`);
        }),
      );

      expect(bleeding).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => window.innerWidth),
      );
    });

    test("어디로 스크롤해도 바가 화면 아래에 남는다", async ({ page }) => {
      await page.goto("/");

      const bar = page.locator(".text-size-bar");
      await expect(bar).toBeInViewport();

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(bar).toBeInViewport();
    });

    test("페이지가 바 높이만큼 아래를 비워 둔다", async ({ page }) => {
      await page.goto("/");

      const room = await page.evaluate(() => {
        const pageEl = document.querySelector(".page");
        const bar = document.querySelector(".text-size-bar");
        if (!pageEl || !bar) return null;
        return {
          padding: parseFloat(getComputedStyle(pageEl).paddingBottom),
          barHeight: bar.getBoundingClientRect().height,
        };
      });

      expect(room).not.toBeNull();
      expect(room!.padding).toBeGreaterThanOrEqual(room!.barHeight);
    });

    test("바가 없는 관리자 화면에는 아래 여백을 두지 않는다", async ({ page }) => {
      await page.goto("/admin");
      await page.locator(".page").waitFor({ timeout: 15_000 });

      const admin = await page.evaluate(() => {
        const pageEl = document.querySelector(".page");
        if (!pageEl) return null;
        return {
          hasBar: !!document.querySelector(".text-size-bar"),
          padding: parseFloat(getComputedStyle(pageEl).paddingBottom),
        };
      });

      expect(admin).not.toBeNull();
      expect(admin!.hasBar).toBe(false);
      expect(admin!.padding).toBe(0);
    });

    test("바의 「가」 표시가 AA 를 넘는다", async ({ page }) => {
      await page.goto("/");

      const ratio = await page.evaluate(() => {
        const mark = document.querySelector(".text-size-bar-mark-small");
        const button = document.querySelector(".text-size-bar-button");
        if (!mark || !button) return null;

        const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (c: number[]) => {
          const ch = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
        };

        const fg = parse(getComputedStyle(mark).color);
        const bg = parse(getComputedStyle(button).backgroundColor);
        const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
        return { ratio: (hi + 0.05) / (lo + 0.05), size: parseFloat(getComputedStyle(mark).fontSize) };
      });

      expect(ratio).not.toBeNull();
      expect(ratio!.size).toBeLessThan(18.66);
      expect(ratio!.ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  test.describe("접근성", () => {
    test.use({ reducedMotion: "reduce" });

    test("색상 토큰 조합이 WCAG AA 를 넘는다", async ({ page }) => {
      await page.goto("/");

      const SMALL = 4.5;
      const LARGE = 3;

      const pairs: [fg: string, bg: string, min: number, where: string][] = [
        ["--text", "--bg", SMALL, "제목"],
        ["--text", "--card", SMALL, "카드 제목·계좌 예금주"],
        ["--text-body", "--bg", SMALL, "본문"],
        ["--text-body", "--card", SMALL, "달력 날짜·요일 12px·인사말·안내 문구 13px"],
        ["--text-sub", "--bg", SMALL, "커버 날짜 캡션 11.5px·푸터 날짜 13px"],
        ["--text-sub", "--card", SMALL, "방명록 날짜 12.5px·글자 수 12.5px·입력 보조 문구 13px"],
        ["--text-body", "--surface", SMALL, "D-Day 일·시·분 라벨 11.5px"],
        ["--text-body", "--surface-3", SMALL, "확인 팝업 항목 라벨 13.5px"],
        ["--muted-2", "--card", SMALL, "갤러리 카운터 18px"],
        ["--primary", "--bg", LARGE, "커버 30px·푸터 34px — 전부 큰 글씨"],
        ["--primary", "--card", SMALL, "교통 안내 라벨 13.5px·혼주 관계 13px·D-Day 일수 14.5px 굵게"],
        ["--on-surface", "--surface-2", SMALL, "공유 버튼 13px"],
        ["--on-surface", "--surface", SMALL, "RSVP 미선택 버튼 14px·잠긴 제출 버튼 15px"],
        ["--on-surface", "--surface-3", SMALL, "개인정보 처리방침 펼치기 13px"],
        ["--text", "--surface-3", SMALL, "개인정보 안내 제목 13.5px·동의 문구 13px·확인 팝업 항목 값 14px"],
        ["--error", "--card", SMALL, "오류 메시지 13px·오류 칸 테두리·초점 링"],
        ["--on-primary", "--primary", SMALL, "달력 예식일 원 14.5px 굵게·주소 복사 버튼 14px"],
        ["--on-primary-sub", "--primary", SMALL, "D-Day 「초」 라벨 11.5px"],
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
      test.setTimeout(60_000);

      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByTestId("loading")).toBeHidden({ timeout: 15_000 });
      await expect(page.locator("header")).toHaveCSS("opacity", "1");

      for (const label of ["신랑측", "신부측"]) {
        await page.getByRole("button", { name: label, exact: true }).click();
      }
      await expect(page.getByRole("button", { name: /계좌번호 복사$/ }).first()).toBeVisible();

      await fillRsvpToConsent(page);
      await page.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }).click();

      await expect(page.getByRole("button", { name: "카카오톡으로 공유" })).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .flatMap((v) =>
          v.nodes.map((n) => `${v.id} · ${n.target.join(" ")} · ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
        );
      expect(blocking).toEqual([]);
    });

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
