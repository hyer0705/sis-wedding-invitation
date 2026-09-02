import { describe, expect, it } from "vitest";
import { supabaseEnvError } from "./supabase";

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

  it("Project ID 만 넣으면 잡아낸다", () => {
    expect(supabaseEnvError("abcdefghijklmnopqrst", KEY_OK)).toContain("Project ID");
  });

  it("경로가 붙은 URL 을 거른다", () => {
    expect(supabaseEnvError(`${URL_OK}/rest/v1`, KEY_OK)).toContain("https");
  });

  it("secret 키를 별도 메시지로 막는다", () => {
    expect(supabaseEnvError(URL_OK, "sb_secret_whatever")).toContain("secret");
  });

  it("레거시 anon 키(JWT)를 거른다", () => {
    expect(supabaseEnvError(URL_OK, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig")).toContain("sb_publishable_");
  });
});
