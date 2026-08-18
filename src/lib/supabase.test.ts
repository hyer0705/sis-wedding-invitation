import { describe, expect, it } from "vitest";
import { supabaseEnvError } from "./supabase";

// 값이 틀려도 화면은 멀쩡해 보이고 회신만 조용히 실패한다. 실패가 보이지 않는
// 경로라 형식 판정을 테스트로 고정한다.
const URL_OK = "https://abcdefghijklmnopqrst.supabase.co";
const KEY_OK = "sb_publishable_test-not-a-real-key";

describe("supabaseEnvError", () => {
  it("형식이 맞으면 null 을 돌려준다", () => {
    expect(supabaseEnvError(URL_OK, KEY_OK)).toBeNull();
  });

  it("끝 슬래시가 붙어도 통과한다", () => {
    expect(supabaseEnvError(`${URL_OK}/`, KEY_OK)).toBeNull();
  });

  it("빠진 값의 이름을 모두 알려준다", () => {
    const message = supabaseEnvError(undefined, undefined);
    expect(message).toContain("VITE_SUPABASE_URL");
    expect(message).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  // 대시보드 Settings → General 이 Project ID 를 "APIs and URLs 에 쓰인다"고
  // 안내해서, URL 자리에 ref 만 넣기 쉽다.
  it("Project ID 만 넣으면 잡아낸다", () => {
    expect(supabaseEnvError("abcdefghijklmnopqrst", KEY_OK)).toContain("Project ID");
  });

  it("경로가 붙은 URL 을 거른다", () => {
    expect(supabaseEnvError(`${URL_OK}/rest/v1`, KEY_OK)).toContain("https");
  });

  // 가장 큰 사고다. VITE_ 가 붙은 값은 청첩장 JS 에 그대로 박히므로,
  // secret 키가 들어오면 RLS 를 우회할 수 있는 키가 공개된다.
  it("secret 키를 별도 메시지로 막는다", () => {
    expect(supabaseEnvError(URL_OK, "sb_secret_whatever")).toContain("secret");
  });

  it("레거시 anon 키(JWT)를 거른다", () => {
    expect(supabaseEnvError(URL_OK, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig")).toContain("sb_publishable_");
  });
});
