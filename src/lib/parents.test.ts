import { describe, expect, it } from "vitest";
import { parentNameLines } from "./parents";

describe("parentNameLines", () => {
  it("IN-03 두 분을 한 분에 한 줄씩 세운다", () => {
    const lines = parentNameLines([
      { name: "홍길동", deceased: false },
      { name: "성춘향", deceased: false },
    ]);
    expect(lines).toEqual([
      { marker: "", name: "홍길동" },
      { marker: "", name: "성춘향" },
    ]);
  });

  it("한 분뿐이면 줄도 하나뿐이다", () => {
    expect(parentNameLines([{ name: "홍길동", deceased: false }])).toEqual([{ marker: "", name: "홍길동" }]);
  });

  it("IN-04 고인 표시는 그 분의 줄에만 붙는다", () => {
    const lines = parentNameLines([
      { name: "홍길동", deceased: true },
      { name: "성춘향", deceased: false },
    ]);
    expect(lines).toEqual([
      { marker: "故", name: "홍길동" },
      { marker: "", name: "성춘향" },
    ]);
  });

  it("IN-04 고인 표시를 성함에 이어 붙이지 않는다", () => {
    const [line] = parentNameLines([{ name: "홍길동", deceased: true }]);

    expect(line.name).toBe("홍길동");
  });

  it("성함이 빈 항목은 자리째로 걷어낸다", () => {
    const lines = parentNameLines([
      { name: "홍길동", deceased: false },
      { name: "   ", deceased: true },
    ]);
    expect(lines).toEqual([{ marker: "", name: "홍길동" }]);
  });

  it("아무도 없으면 줄도 없다", () => {
    expect(parentNameLines([])).toEqual([]);
  });
});
