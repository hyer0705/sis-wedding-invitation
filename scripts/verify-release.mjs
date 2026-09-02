import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { readEnvFile, envValue } from "./read-env.mjs";

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

const appSource = await readFile("src/App.tsx", "utf8");
const imported = new Map(
  [...appSource.matchAll(/^import\s+(?:{[^}]*}|(\w+))(?:\s*,\s*{[^}]*})?\s+from\s+"\.\/(components\/[\w/]+)";/gm)]
    .filter(([, name]) => name)
    .map(([, name, modulePath]) => [name, `src/${modulePath}.tsx`]),
);

for (const [name, file] of imported) {
  if (!new RegExp(`<${name}[\\s/>]`).test(appSource)) continue;

  let source;
  try {
    source = await readFile(file, "utf8");
  } catch {
    errors.push(`${file} 을 읽지 못했습니다 — App.tsx 가 ${name} 을 그리고 있습니다`);
    continue;
  }
  if (/className="todo"/.test(source)) {
    errors.push(`${file}: 자리표시(.todo) 섹션이 그대로 렌더됩니다 — 구현하거나 App.tsx 에서 빼세요`);
  }
}

if (/<Rsvp[\s/>]/.test(appSource)) {
  const rsvpLib = await readFile("src/lib/rsvp.ts", "utf8");
  if (!/\.from\((?:TABLE|"rsvp")\)\s*\.insert\(/.test(rsvpLib)) {
    errors.push(
      "src/lib/rsvp.ts 에서 rsvp 테이블 insert 를 찾지 못했습니다 (SIS-20) — 폼은 보이는데 회신이 전부 실패하거나, 게이트가 무력화된 상태입니다",
    );
  }
}

const inviteSource = await readFile("src/invite.ts", "utf8");
const isMockMatch = /^\s*isMock:\s*(true|false)\s*,/m.exec(inviteSource);
if (!isMockMatch) {
  errors.push("src/invite.ts에서 isMock 플래그를 찾지 못했습니다 — 게이트가 무력화됩니다");
} else if (isMockMatch[1] === "true") {
  errors.push("INVITE.isMock === true — 고객 확정값 미반영. mock 데이터로는 배포할 수 없습니다");
}

const REQUIRED_ENV = [
  "VITE_GROOM_FATHER",
  "VITE_BRIDE_FATHER",
  "VITE_BRIDE_MOTHER",
  "VITE_ACCOUNTS_GROOM",
  "VITE_ACCOUNTS_BRIDE",
];

const envFile = await readEnvFile();
const missingEnv = REQUIRED_ENV.filter((key) => !envValue(key, envFile));
if (missingEnv.length > 0) {
  errors.push(`개인정보 환경변수 미설정: ${missingEnv.join(", ")} — mock 값이 그대로 배포됩니다`);
}

const OFFICER_ENV = ["VITE_PRIVACY_OFFICER_NAME", "VITE_PRIVACY_OFFICER_EMAIL"];
const missingOfficer = OFFICER_ENV.filter((key) => !envValue(key, envFile));
if (missingOfficer.length > 0) {
  errors.push(`개인정보 보호 담당자 미설정: ${missingOfficer.join(", ")} — 처리방침에 문의처가 빠진 채 배포됩니다`);
}

const officerEmail = envValue("VITE_PRIVACY_OFFICER_EMAIL", envFile);
if (officerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officerEmail)) {
  errors.push("VITE_PRIVACY_OFFICER_EMAIL 형식이 이메일이 아닙니다 — 처리방침의 문의처가 닿지 않습니다");
}

const supabaseUrl = envValue("VITE_SUPABASE_URL", envFile);
const supabaseKey = envValue("VITE_SUPABASE_PUBLISHABLE_KEY", envFile);
if (!supabaseUrl || !supabaseKey) {
  const missing = [!supabaseUrl && "VITE_SUPABASE_URL", !supabaseKey && "VITE_SUPABASE_PUBLISHABLE_KEY"].filter(Boolean);
  errors.push(`Supabase 환경변수 미설정: ${missing.join(", ")} — RSVP 회신이 저장되지 않습니다`);
} else {
  if (!/^https:\/\/[^/\s]+$/.test(supabaseUrl.replace(/\/+$/, ""))) {
    errors.push(
      "VITE_SUPABASE_URL 이 https 절대 URL 이 아닙니다 — Project ID 가 아니라 https://<project-ref>.supabase.co 형식이어야 합니다",
    );
  }
  if (supabaseKey.startsWith("sb_secret_")) {
    errors.push(
      "VITE_SUPABASE_PUBLISHABLE_KEY 에 secret 키가 들어 있습니다 — 청첩장 JS 에 박혀 RLS 가 무력화됩니다. 즉시 교체하세요",
    );
  } else if (!supabaseKey.startsWith("sb_publishable_")) {
    errors.push(
      "VITE_SUPABASE_PUBLISHABLE_KEY 형식이 아닙니다 — sb_publishable_ 로 시작하는 값이어야 합니다 (레거시 anon 키는 2026년 말 지원 종료)",
    );
  }
}

const EXPECTED_ACCOUNTS = { VITE_ACCOUNTS_GROOM: 2, VITE_ACCOUNTS_BRIDE: 2 };

for (const [key, expected] of Object.entries(EXPECTED_ACCOUNTS)) {
  const raw = envValue(key, envFile);
  if (!raw) continue;

  const entries = raw.split(";").filter((entry) => entry.trim());
  const wellFormed = entries.filter(
    (entry) =>
      entry
        .split("|")
        .map((f) => f.trim())
        .filter(Boolean).length === 4,
  );

  if (wellFormed.length !== expected) {
    const dropped = entries.length - wellFormed.length;
    errors.push(
      `${key}: 계좌 ${expected}건이 필요한데 ${wellFormed.length}건만 읽힙니다` +
        (dropped > 0 ? ` (형식이 어긋난 항목 ${dropped}건은 화면에 나오지 않습니다 — 구분자는 항목 ";" · 필드 "|")` : ""),
    );
  }
}

const imageBase = envValue("VITE_IMAGE_BASE_URL", envFile);
if (!imageBase) {
  errors.push("VITE_IMAGE_BASE_URL 미설정 — 사진이 로컬 폴백(/images)을 가리켜 배포본에서 전부 깨집니다");
} else if (!/^https:\/\//.test(imageBase)) {
  errors.push(`VITE_IMAGE_BASE_URL 이 https 절대 URL 이 아닙니다: ${imageBase}`);
} else {
  const coverSource = await readFile("src/components/Cover.tsx", "utf8");
  const coverMatch = /^(?:export\s+)?const COVER_NAME = "([^"]+)";/m.exec(coverSource);
  if (!coverMatch) {
    errors.push("Cover.tsx 에서 COVER_NAME 을 찾지 못했습니다 — 게이트가 무력화됩니다");
  }

  const locationSource = await readFile("src/components/Location.tsx", "utf8");
  const logoFiles = [...locationSource.matchAll(/logo="([^"]+\.webp)"/g)].map((m) => m[1]);
  if (logoFiles.length === 0) {
    errors.push("Location.tsx 에서 지도 앱 로고 파일명을 찾지 못했습니다 — 게이트가 무력화됩니다");
  }

  let bgmFile = null;
  if (/<Bgm[\s/>]/.test(appSource)) {
    const bgmSource = await readFile("src/lib/bgm.ts", "utf8");
    const bgmMatch = /^export const BGM_FILE = "([^"]+)";/m.exec(bgmSource);
    if (!bgmMatch) {
      errors.push("src/lib/bgm.ts 에서 BGM_FILE 을 찾지 못했습니다 — 게이트가 무력화됩니다");
    } else {
      bgmFile = bgmMatch[1];
    }
  }

  const base = imageBase.replace(/\/+$/, "");
  const targets = [
    coverMatch && { label: "커버 사진", url: `${base}/${coverMatch[1]}-960.webp` },
    { label: "카톡 공유 썸네일(og-image.jpg)", url: `${base}/og-image.jpg` },
    ...logoFiles.map((file) => ({ label: `지도 앱 로고(${file})`, url: `${base}/${file}` })),
    bgmFile && { label: `배경음악(${bgmFile})`, url: `${base}/${bgmFile}`, maxBytes: 3 * 1024 * 1024 },
  ].filter(Boolean);

  for (const { label, url, maxBytes } of targets) {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        errors.push(`${label}에 접근할 수 없습니다 (HTTP ${res.status}): ${url} — 버킷 공개 설정과 업로드 여부를 확인하세요`);
        continue;
      }
      const size = Number(res.headers.get("content-length"));
      if (maxBytes && size > maxBytes) {
        errors.push(
          `${label}이 규격을 넘습니다 (${(size / 1024 / 1024).toFixed(2)}MB > ${maxBytes / 1024 / 1024}MB) — npm run optimize:audio 산출물로 다시 올리세요`,
        );
      }
    } catch (e) {
      errors.push(`${label} 확인 실패: ${url} — ${e.message}`);
    }
  }
}

try {
  await stat("public/images/mock");
  errors.push("public/images/mock/ 이 남아 있습니다 — 실사진으로 교체 후 삭제하세요");
} catch {}

try {
  await stat("public/og-image.jpg");
  errors.push("public/og-image.jpg 가 리포에 남아 있습니다 — 이미지는 R2 에서만 관리합니다(SIS-24)");
} catch {}

if (errors.length > 0) {
  console.error("배포 게이트 실패:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("배포 게이트 통과 (이미지 출처 도달 확인)");
