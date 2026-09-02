import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 4 : undefined,
  reporter: isCI ? "github" : "list",
  timeout: 30_000,
  expect: {
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
      name: "mobile-320",
      use: { ...devices["Galaxy S9+"], browserName: "chromium", viewport: { width: 320, height: 740 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "mobile-430",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 430, height: 900 } },
    },
    ...(isCI ? [{ name: "ios-safari", use: { ...devices["iPhone 13"] } }] : []),
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      VITE_ACCOUNTS_GROOM: "신랑|행복은행|111-111-111111|김신랑;신랑 아버지|행복은행|222-222-222222|김아버지",
      VITE_ACCOUNTS_BRIDE: "신부|행복은행|333-333-333333|이신부;신부 어머니|행복은행|444-444-444444|이어머니",
      VITE_SUPABASE_URL: "https://rsvp-e2e.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e-not-a-real-key",
    },
  },
});
