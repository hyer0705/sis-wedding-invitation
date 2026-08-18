import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// 청첩장은 사실상 모바일 전용이다. 명세서 CM-01(320px~430px)을 세 지점으로 나눠 검증한다.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // CI 러너는 4 vCPU 인데 오래 워커 1개로 직렬 실행했다(M1 세팅부터, 근거는 남아 있지
  // 않다). 브라우저 설치를 걷어내고 나니 이 직렬 실행이 E2E 잡의 80%(5분 55초)였다 —
  // 로컬 4워커 1분 6초를 직렬 환산한 값과 거의 정확히 맞는다 (SIS-34).
  //
  // 정적 파일을 내주는 preview 서버 하나를 워커들이 함께 쓰므로 서버 쪽은 병목이 아니다.
  // 병렬로 흔들리는 테스트가 나오면 workers 를 줄이기 전에 그 테스트를 고친다 — 워커를
  // 되돌리면 원인은 그대로 남고 시간만 다시 늘어난다.
  workers: isCI ? 4 : undefined,
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
    // 계좌에는 mock 폴백이 없어(src/invite.ts) 환경변수를 넣지 않으면 마음 전하실 곳
    // 섹션이 통째로 사라진다. 그러면 CI 에서 접근성 감사가 그 섹션을 한 번도 보지 못한다.
    // 여기서 넣는 값은 모든 자리가 같은 숫자인 가짜다. 고객 실계좌(.env)가 있는 로컬에서도
    // 이 값이 이기므로, 테스트 화면에 실제 계좌번호가 뜨는 일은 없다.
    //
    // Supabase 값도 여기서 덮는다(SIS-20). 회신 제출 왕복을 E2E 로 보려면 클라이언트가
    // 만들어져야 하는데(없으면 getSupabase 가 던진다), 로컬 .env 의 실제 값으로 빌드되면
    // 테스트가 고객의 진짜 테이블에 행을 쌓는다. `.invalid` 는 RFC 2606 이 예약한
    // 도메인이라 절대 해석되지 않는다 — 스텁을 깜빡한 테스트가 있어도 나갈 곳이 없다.
    env: {
      VITE_ACCOUNTS_GROOM: "신랑|행복은행|111-111-111111|김신랑;신랑 아버지|행복은행|222-222-222222|김아버지",
      VITE_ACCOUNTS_BRIDE: "신부|행복은행|333-333-333333|이신부;신부 어머니|행복은행|444-444-444444|이어머니",
      VITE_SUPABASE_URL: "https://rsvp-e2e.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e-not-a-real-key",
    },
  },
});
