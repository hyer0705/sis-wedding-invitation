// 배포 게이트 — placeholder가 남아 있거나 사진을 받아올 수 없으면 실패(exit 1)한다.
// 배포 전 반드시 `npm run verify`가 통과해야 한다.
//
// mock 데이터는 형식이 진짜와 같아서 placeholder 정규식에 걸리지 않는다. 그래서
// `INVITE.isMock` 플래그와 mock 이미지 디렉터리를 따로 검사한다 — 이 둘이 없으면
// 가짜 계좌번호가 그대로 배포될 수 있다.
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

// 자리표시 섹션이 그대로 나가는 것을 막는다.
//
// PLACEHOLDERS 문자열 검사만으로는 이것을 잡지 못했다. 미구현 섹션은 `.todo` 클래스로
// "○○ 예정" 같은 문구를 띄우는데 그 문구가 매번 달라서다. 실제로 RSVP 가 스텁인 채로
// 배포 게이트를 통과할 수 있는 상태였다(2026-08-13 발견).
//
// src 전체가 아니라 **App.tsx 가 실제로 그리는 컴포넌트**만 본다. 렌더되지 않는 파일에
// 남은 자리표시는 하객에게 보이지 않으므로 배포를 막을 이유가 없다 — v1 에서 빠진
// Rsvp.tsx 가 그 경우다.
const appSource = await readFile("src/App.tsx", "utf8");
const imported = new Map(
  [...appSource.matchAll(/^import\s+(?:{[^}]*}|(\w+))(?:\s*,\s*{[^}]*})?\s+from\s+"\.\/(components\/\w+)";/gm)]
    .filter(([, name]) => name)
    .map(([, name, modulePath]) => [name, `src/${modulePath}.tsx`]),
);

for (const [name, file] of imported) {
  // import 만 하고 그리지 않는 컴포넌트는 대상이 아니다. JSX 로 쓰인 것만 본다.
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

// RSVP 전송 연결 여부(SIS-20). `.todo` 와 같은 종류의 미완성이지만 화면에는 전혀
// 드러나지 않는다 — 폼은 멀쩡히 그려지고 제출만 매번 실패하므로, 하객은 자기 문제로
// 여기고 고객은 회신이 0건인 이유를 알 수 없다. 눈으로 잡히지 않아 여기서 막는다.
//
// 미연결 표식(RSVP_NOT_WIRED)을 찾던 검사를 뒤집어, **연결되어 있음**을 확인하는
// 쪽으로 바꿨다. 표식을 찾는 방식은 SIS-20 이 그 이름을 지운 순간 아무것도 잡지
// 못한 채 늘 통과하게 되고, 게이트가 죽었다는 사실조차 드러나지 않는다.
//
// App.tsx 가 Rsvp 를 그릴 때만 본다. 섹션을 뺀 상태라면 미연결이어도 배포에 지장이 없다.
if (/<Rsvp[\s/>]/.test(appSource)) {
  const rsvpLib = await readFile("src/lib/rsvp.ts", "utf8");
  if (!/\.from\((?:TABLE|"rsvp")\)\s*\.insert\(/.test(rsvpLib)) {
    errors.push(
      "src/lib/rsvp.ts 에서 rsvp 테이블 insert 를 찾지 못했습니다 (SIS-20) — 폼은 보이는데 회신이 전부 실패하거나, 게이트가 무력화된 상태입니다",
    );
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
//
// VITE_GROOM_MOTHER 는 목록에 없다. 신랑 어머니를 표기하지 않기로 고객이 확정해
// (2026-08-11) INVITE.groom.parents 에서 항목 자체를 뺐고, 들어올 일이 없는 값을
// 필수로 두면 배포 게이트가 영원히 열리지 않는다.
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

// 개인정보 보호 담당자(RS-03) — 처리방침이 「열람·정정·삭제 요청은 담당자에게」라고
// 안내하는 창구다. 계좌와 같은 이유로 mock 을 두지 않았으므로(src/invite.ts) 값이
// 비면 담당자 문단이 화면에서 통째로 사라진다. 권리 행사 창구 없는 처리방침은
// 법적 요구를 채우지 못하므로 그 상태로는 배포할 수 없다.
const OFFICER_ENV = ["VITE_PRIVACY_OFFICER_NAME", "VITE_PRIVACY_OFFICER_EMAIL"];
const missingOfficer = OFFICER_ENV.filter((key) => !envValue(key, envFile));
if (missingOfficer.length > 0) {
  errors.push(`개인정보 보호 담당자 미설정: ${missingOfficer.join(", ")} — 처리방침에 문의처가 빠진 채 배포됩니다`);
}

// 오타 난 주소는 값이 있는 것과 구별되지 않는다. 받는 사람이 없는 메일함으로
// 안내하면 창구가 없는 것과 같으므로 형식만이라도 본다.
const officerEmail = envValue("VITE_PRIVACY_OFFICER_EMAIL", envFile);
if (officerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officerEmail)) {
  errors.push("VITE_PRIVACY_OFFICER_EMAIL 형식이 이메일이 아닙니다 — 처리방침의 문의처가 닿지 않습니다");
}

// Supabase(SIS-33) — RSVP 수신처다. 값이 없거나 형식이 어긋나면 폼은 정상으로
// 보이는데 회신만 조용히 실패한다. 하객도 고객도 알 수 없는 실패라 게이트에서 막는다.
//
// 형식 판정은 src/lib/supabase.ts 의 supabaseEnvError 와 같은 규칙이다. 그쪽은
// 브라우저용 TS 라 여기서 import 할 수 없어(이 스크립트는 빌드 없이 도는 순수
// node 다) 규칙만 옮겨 적었다 — 한쪽을 고치면 다른 쪽도 고친다.
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

// 계좌는 "값이 있는가"만으로는 부족하다. parseAccounts 는 `역할|은행|계좌번호|예금주`
// 네 마디가 아닌 항목을 조용히 버리므로, 구분자 하나만 틀려도 그 계좌가 화면에서
// 사라진 채 배포된다 — 실제로 신부 어머니 계좌 하나가 이렇게 빠진 적이 있다(2026-08-11).
// 값이 아니라 건수만 센다. 계좌번호를 이 스크립트가 들여다보지 않게 하기 위해서다.
//
// 고객 확정 구성은 신랑측 2건(신랑·아버지) · 신부측 2건(신부·어머니)이다. 구성이
// 바뀌면 이 숫자를 함께 고친다 — 고치지 않으면 배포가 막혀 곧바로 드러난다.
const EXPECTED_ACCOUNTS = { VITE_ACCOUNTS_GROOM: 2, VITE_ACCOUNTS_BRIDE: 2 };

for (const [key, expected] of Object.entries(EXPECTED_ACCOUNTS)) {
  const raw = envValue(key, envFile);
  if (!raw) continue; // 미설정은 위에서 이미 보고했다

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

// 사진은 Cloudflare R2 에서 온다(SIS-28). public/images/ 는 optimize 산출물을
// 잠시 두는 로컬 작업 폴더일 뿐 배포물에 들어가지 않으므로, 여기서 볼 것은
// 파일 용량이 아니라 "배포된 사이트가 사진을 실제로 받아올 수 있는가"다.
const imageBase = envValue("VITE_IMAGE_BASE_URL", envFile);
if (!imageBase) {
  errors.push("VITE_IMAGE_BASE_URL 미설정 — 사진이 로컬 폴백(/images)을 가리켜 배포본에서 전부 깨집니다");
} else if (!/^https:\/\//.test(imageBase)) {
  errors.push(`VITE_IMAGE_BASE_URL 이 https 절대 URL 이 아닙니다: ${imageBase}`);
} else {
  // 커버 사진 이름은 컴포넌트가 단일 기준이다. 게이트에 이름을 또 적으면
  // 사진 교체 때 한쪽만 바뀌어 게이트가 엉뚱한 파일을 확인하게 된다.
  const coverSource = await readFile("src/components/Cover.tsx", "utf8");
  // export 는 있어도 없어도 받는다. 로딩 화면(SIS-17)이 이 상수를 읽어야 해서 export 가
  // 붙었을 때 이 정규식이 못 잡았고, 커버 사진의 R2 도달 확인이 통째로 건너뛰어졌다.
  const coverMatch = /^(?:export\s+)?const COVER_NAME = "([^"]+)";/m.exec(coverSource);
  if (!coverMatch) {
    errors.push("Cover.tsx 에서 COVER_NAME 을 찾지 못했습니다 — 게이트가 무력화됩니다");
  }

  // 지도 앱 로고도 R2 에 있다(SIS-32). 파일명은 컴포넌트가 단일 기준이다 — 여기에
  // 또 적으면 로고를 교체할 때 한쪽만 바뀌어 게이트가 엉뚱한 파일을 확인한다.
  //
  // 로고를 굳이 확인하는 이유는 조용히 사라지기 때문이다. 라벨이 이름을 말하므로
  // 로고에는 alt 가 없고(장식), 404 가 나도 화면에 깨진 아이콘조차 남지 않는다.
  // 고객이 명시적으로 요청한 변경이 아무 신호 없이 없어지는 경로다.
  const locationSource = await readFile("src/components/Location.tsx", "utf8");
  const logoFiles = [...locationSource.matchAll(/logo="([^"]+\.webp)"/g)].map((m) => m[1]);
  if (logoFiles.length === 0) {
    errors.push("Location.tsx 에서 지도 앱 로고 파일명을 찾지 못했습니다 — 게이트가 무력화됩니다");
  }

  // 배경음악도 같은 버킷에 있다(SIS-27). 로고와 같은 이유로 확인한다 — 404 가 나도
  // 토글은 멀쩡히 그려지고 눌러도 아무 일이 없을 뿐이라 화면에 신호가 남지 않는다.
  // 파일명은 lib 가 단일 기준이다.
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
    // og-image 도 R2 에 둔다(SIS-24). 카톡 스크래퍼가 여기서 못 받아오면 공유
    // 카드에 썸네일이 통째로 빠진다.
    { label: "카톡 공유 썸네일(og-image.jpg)", url: `${base}/og-image.jpg` },
    ...logoFiles.map((file) => ({ label: `지도 앱 로고(${file})`, url: `${base}/${file}` })),
    // 명세서가 정한 규격은 mp3 3MB 이하다. 로컬 산출은 optimize:audio 가 막지만,
    // 버킷에 옛 파일이 남아 있으면 하객이 받는 것은 그쪽이다.
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

// mock 이미지는 SIS-11에서 생긴다. R2 로 그대로 올라가면 가짜 사진이 배포된다.
try {
  await stat("public/images/mock");
  errors.push("public/images/mock/ 이 남아 있습니다 — 실사진으로 교체 후 삭제하세요");
} catch {
  // 없는 것이 정상이다.
}

// og-image 는 위 R2 도달 확인이 대신한다. 리포에 남아 있으면 R2 쪽과 어긋난
// 사진이 배포될 수 있으므로 오히려 없어야 한다.
try {
  await stat("public/og-image.jpg");
  errors.push("public/og-image.jpg 가 리포에 남아 있습니다 — 이미지는 R2 에서만 관리합니다(SIS-24)");
} catch {
  // 없는 것이 정상이다.
}

if (errors.length > 0) {
  console.error("배포 게이트 실패:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
// 성공 로그에 베이스 URL 을 찍지 않는다. 통과했다는 사실만 있으면 충분한데,
// 로그를 캡처해 공유하는 순간 버킷 주소가 같이 나가기 때문이다.
// 실패 메시지에는 URL 을 남긴다 — 그때는 어디가 안 되는지 봐야 한다.
console.log("배포 게이트 통과 (이미지 출처 도달 확인)");
