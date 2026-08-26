import { describe, expect, it } from "vitest";
import { BGM_FILE, bgmUrl } from "./bgm";

describe("bgmUrl", () => {
  it("베이스 URL 아래의 파일을 가리킨다", () => {
    expect(bgmUrl("https://assets.example.com")).toBe(`https://assets.example.com/${BGM_FILE}`);
  });

  it("베이스 뒤의 슬래시가 겹치지 않는다", () => {
    expect(bgmUrl("https://assets.example.com/")).toBe(`https://assets.example.com/${BGM_FILE}`);
  });

  it("베이스가 비면 로컬 폴백은 사진과 다른 /audio 아래다", () => {
    expect(bgmUrl("")).toBe(`/audio/${BGM_FILE}`);
    expect(bgmUrl("   ")).toBe(`/audio/${BGM_FILE}`);
  });
});
