// 스크립트용 환경변수 읽기. 로컬은 `.env` 파일, CI·Vercel 은 process.env 로 들어온다.
//
// verify-release.mjs 와 rls-smoke.mjs 가 같은 규칙으로 읽어야 해서 한 곳에 둔다.
// 규칙이 갈리면 한쪽만 통과하는 상태가 생긴다.
//
// 읽은 값을 로그에 찍지 않는다. 이 파일을 쓰는 쪽도 "있다/없다"와 형식만 보고하고
// 값 자체는 출력하지 않는다.
import { readFile } from "node:fs/promises";

/** `.env` 를 파싱한다. 파일이 없는 것은 정상이다(Vercel·CI). */
export async function readEnvFile(file = ".env") {
  const values = {};
  try {
    const text = await readFile(file, "utf8");
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) values[m[1]] = m[2].trim();
    }
  } catch {
    // 없으면 process.env 만으로 판단한다.
  }
  return values;
}

/** process.env 를 우선하고 `.env` 로 폴백한다. */
export function envValue(key, envFile) {
  return (process.env[key] || envFile[key] || "").trim();
}
