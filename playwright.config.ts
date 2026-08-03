import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// 청첩장은 사실상 모바일 전용이다. 명세서 CM-01(320px~430px)을 세 지점으로 나눠 검증한다.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "github" : "list",
  timeout: 30_000,
  expect: {
    // 시각 회귀: 폰트 렌더링 편차를 감안해 소폭 허용
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: "http://localhost:4173",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "on-first-retry",
  },
  projects: [
    {
      // CM-01 하한: 320px
      name: "mobile-320",
      use: { ...devices["Galaxy S9+"], browserName: "chromium", viewport: { width: 320, height: 740 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      // CM-01 상한: 레이아웃 최대 폭 430px 경계
      name: "mobile-430",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 430, height: 900 } },
    },
    // CM-09 iOS Safari 엔진 검증. 로컬 macOS에서는 webkit 바이너리가 Bus error로 죽어
    // CI(ubuntu)에서만 실행한다. 실기기 확인은 docs/manual-qa.md의 수동 항목으로 남는다.
    ...(isCI ? [{ name: "ios-safari", use: { ...devices["iPhone 13"] } }] : []),
  ],
  // dev 서버는 모듈을 요청 시점에 변환해 병렬 워커에서 로딩 타이밍이 흔들린다.
  // 빌드 결과물을 preview로 띄워 실제 배포와 같은 조건에서 검증한다.
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
