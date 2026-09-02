import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const html = readFileSync(path.join(root, "index.html"), "utf8");
const tokens = readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");

function ruleBody(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = css.match(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`));
  if (!found) throw new Error(`${selector} 규칙을 찾지 못했습니다 — 선택자가 바뀌었다면 이 테스트도 함께 고칩니다`);
  return found[1];
}

function declaration(body, property) {
  const found = body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`));
  if (!found) throw new Error(`${property} 선언을 찾지 못했습니다`);
  return found[1].trim();
}

const token = (name) => declaration(ruleBody(tokens, ":root"), name);
const boot = (selector, property) => declaration(ruleBody(html, selector), property);

const 함께고쳐야한다 =
  "부트 화면은 tokens.css 가 도착하기 전에 그려져야 해서 var() 를 쓰지 못하고 값을 손으로 베껴 두었습니다. " +
  "한쪽만 고치면 첫 화면과 본 화면이 어긋난 채 배포되는데, 오류가 나지 않아 실기기로 보기 전까지 아무도 모릅니다. " +
  "index.html 의 #boot 스타일과 tokens.css 를 함께 고쳐 주세요.";

describe("부트 화면이 베껴 둔 tokens.css 값", () => {
  it("#boot 의 폭이 --page-max 와 같다", () => {
    expect(boot("#boot", "max-width"), 함께고쳐야한다).toBe(token("--page-max"));
  });

  it("#boot 의 배경색이 --bg 와 같다", () => {
    expect(boot("#boot", "background"), 함께고쳐야한다).toBe(token("--bg"));
  });

  it("「The wedding of」 글자색이 --primary 와 같다", () => {
    expect(boot(".boot-title", "color"), 함께고쳐야한다).toBe(token("--primary"));
  });

  it("진행선 바탕이 --input-border 와 같다", () => {
    expect(boot(".boot-track", "background"), 함께고쳐야한다).toBe(token("--input-border"));
  });

  it("진행선이 --primary 와 같다", () => {
    expect(boot(".boot-track i", "background"), 함께고쳐야한다).toBe(token("--primary"));
  });
});
