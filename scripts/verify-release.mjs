// 배포 게이트 — placeholder가 남아 있거나 사진을 받아올 수 없으면 실패(exit 1)한다.
// 배포 전 반드시 `npm run verify`가 통과해야 한다.
//
// mock 데이터는 형식이 진짜와 같아서 placeholder 정규식에 걸리지 않는다. 그래서
// `INVITE.isMock` 플래그와 mock 이미지 디렉터리를 따로 검사한다 — 이 둘이 없으면
// 가짜 계좌번호가 그대로 배포될 수 있다.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const PLACEHOLDERS = ["○○", "000-000-000000", "MAP PREVIEW"];
const errors = [];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const targets = ["index.html"];
for await (const f of walk("src")) {
  if (/\.(tsx?|css|html)$/.test(f)) targets.push(f);
}
for (const file of targets) {
  const text = await readFile(file, "utf8");
  for (const p of PLACEHOLDERS) {
    if (text.includes(p)) errors.push(`${file}: placeholder "${p}" 잔존`);
  }
}

// INVITE.isMock — 고객 확정값이 아직 반영되지 않았다는 뜻이다.
// 정규식으로 읽는 이유는 verify가 빌드 없이 도는 순수 node 스크립트이기 때문이다.
const inviteSource = await readFile("src/invite.ts", "utf8");
const isMockMatch = /^\s*isMock:\s*(true|false)\s*,/m.exec(inviteSource);
if (!isMockMatch) {
  errors.push("src/invite.ts에서 isMock 플래그를 찾지 못했습니다 — 게이트가 무력화됩니다");
} else if (isMockMatch[1] === "true") {
  errors.push("INVITE.isMock === true — 고객 확정값 미반영. mock 데이터로는 배포할 수 없습니다");
}

// 계좌·혼주 성함은 리포에 없다. 주입되지 않으면 mock 이 그대로 배포되므로,
// 화면에 나갈 값이 실제로 들어왔는지 여기서 확인한다.
// 로컬은 .env 파일, Vercel 은 process.env 로 들어온다.
const REQUIRED_ENV = [
  "VITE_GROOM_FATHER",
  "VITE_GROOM_MOTHER",
  "VITE_BRIDE_FATHER",
  "VITE_BRIDE_MOTHER",
  "VITE_ACCOUNTS_GROOM",
  "VITE_ACCOUNTS_BRIDE",
];

async function readEnvFile() {
  const values = {};
  try {
    const text = await readFile(".env", "utf8");
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) values[m[1]] = m[2].trim();
    }
  } catch {
    // .env 가 없는 것은 정상이다 — Vercel 에서는 process.env 로 들어온다.
  }
  return values;
}

const envFile = await readEnvFile();
const missingEnv = REQUIRED_ENV.filter((key) => !(process.env[key] || envFile[key]));
if (missingEnv.length > 0) {
  errors.push(`개인정보 환경변수 미설정: ${missingEnv.join(", ")} — mock 값이 그대로 배포됩니다`);
}

// 사진은 Cloudflare R2 에서 온다(SIS-28). public/images/ 는 optimize 산출물을
// 잠시 두는 로컬 작업 폴더일 뿐 배포물에 들어가지 않으므로, 여기서 볼 것은
// 파일 용량이 아니라 "배포된 사이트가 사진을 실제로 받아올 수 있는가"다.
const imageBase = (process.env.VITE_IMAGE_BASE_URL || envFile.VITE_IMAGE_BASE_URL || "").trim();
if (!imageBase) {
  errors.push("VITE_IMAGE_BASE_URL 미설정 — 사진이 로컬 폴백(/images)을 가리켜 배포본에서 전부 깨집니다");
} else if (!/^https:\/\//.test(imageBase)) {
  errors.push(`VITE_IMAGE_BASE_URL 이 https 절대 URL 이 아닙니다: ${imageBase}`);
} else {
  // 커버 사진 이름은 컴포넌트가 단일 기준이다. 게이트에 이름을 또 적으면
  // 사진 교체 때 한쪽만 바뀌어 게이트가 엉뚱한 파일을 확인하게 된다.
  const coverSource = await readFile("src/components/Cover.tsx", "utf8");
  const coverMatch = /^const COVER_NAME = "([^"]+)";/m.exec(coverSource);
  if (!coverMatch) {
    errors.push("Cover.tsx 에서 COVER_NAME 을 찾지 못했습니다 — 게이트가 무력화됩니다");
  } else {
    const url = `${imageBase.replace(/\/+$/, "")}/${coverMatch[1]}-960.webp`;
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        errors.push(`커버 사진에 접근할 수 없습니다 (HTTP ${res.status}): ${url} — 버킷 공개 설정과 업로드 여부를 확인하세요`);
      }
    } catch (e) {
      errors.push(`커버 사진 확인 실패: ${url} — ${e.message}`);
    }
  }
}

// mock 이미지는 SIS-11에서 생긴다. R2 로 그대로 올라가면 가짜 사진이 배포된다.
try {
  await stat("public/images/mock");
  errors.push("public/images/mock/ 이 남아 있습니다 — 실사진으로 교체 후 삭제하세요");
} catch {
  // 없는 것이 정상이다.
}

try {
  await stat("public/og-image.jpg");
} catch {
  errors.push("public/og-image.jpg 없음 — 카톡 공유 썸네일 필요");
}

if (errors.length > 0) {
  console.error("배포 게이트 실패:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`배포 게이트 통과 (이미지 출처 ${imageBase})`);
