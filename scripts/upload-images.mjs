// public/images/ 와 public/audio/ 의 최적화 산출물을 Cloudflare R2 버킷으로 올린다
// (SIS-28 · SIS-27).
//
//   npm run optimize                    원본 → WebP 2벌 (public/images/)
//   npm run optimize:audio              원본 → 90초 mp3 (public/audio/)
//   npm run upload:images -- --dry-run  올릴 파일 목록만 확인 (자격증명 불필요)
//   npm run upload:images               두 폴더 → R2
//
// --dry-run 앞의 `--` 를 빼면 npm 이 자기 플래그로 먹어 스크립트에 전달되지 않는다.
//
// 자격증명은 .env 에서만 읽고 리포에는 두지 않는다. VITE_ 접두사를 쓰지 않는
// 이유는 그 접두사가 붙은 값은 Vite 가 클라이언트 번들에 그대로 넣기 때문이다 —
// 시크릿 키가 청첩장 JS 에 박히면 누구나 버킷에 쓸 수 있게 된다.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

// 버킷 안에서는 한 겹으로 눕는다 — 화면이 부르는 주소가 베이스 바로 아래이기
// 때문이다(src/lib/imageUrl.ts 의 assetUrl). 그래서 폴더가 둘이어도 R2 키는
// 파일명 하나뿐이고, 같은 이름이 양쪽에 있으면 한쪽이 조용히 덮인다 — 아래에서 막는다.
const SOURCES = ["public/images", "public/audio"];

// WebP 는 사이트가 렌더하는 사진, JPEG 는 카톡 공유 카드용 og-image,
// mp3 는 배경음악이다(SIS-27).
const CONTENT_TYPES = { ".webp": "image/webp", ".jpg": "image/jpeg", ".mp3": "audio/mpeg" };

// 사진을 교체해도 파일명을 그대로 쓰기로 했다(SIS-28). immutable 로 걸면 교체분이
// 하객 브라우저에 몇 달씩 안 내려가므로, 하루면 퍼지는 값으로 둔다.
const CACHE_CONTROL = "public, max-age=86400";

const dryRun = process.argv.includes("--dry-run");

const REQUIRED_ENV = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];

/**
 * 빠진 키를 모두 모아 한 번에 알린다. 하나씩 알리면 채우고 다시 돌리기를
 * 네 번 반복하게 된다. 값은 절대 찍지 않는다 — 이름만으로 충분하다.
 */
function requireEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(`.env 에 다음 키가 비어 있습니다 (형식: .env.example)`);
    for (const name of missing) console.error(`  - ${name}`);
    process.exit(1);
  }
  return Object.fromEntries(REQUIRED_ENV.map((name) => [name, process.env[name].trim()]));
}

// .env 를 읽는다. Vite 없이 도는 스크립트라 dotenv 대신 Node 내장 기능을 쓴다.
// Vite 와 같은 파일을 보도록 .env.local 까지 훑는다 — 한쪽에만 적어 두고
// "왜 안 읽히지" 하는 상황을 막는다. 뒤에 오는 파일이 앞을 덮는다.
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // 없는 것은 정상이다. 값 누락은 아래 requireEnv 가 잡는다.
  }
}

const files = [];
const seen = new Map();
for (const dir of SOURCES) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    continue;
  }
  for (const name of names.sort()) {
    if (!(path.extname(name).toLowerCase() in CONTENT_TYPES)) continue;
    const before = seen.get(name);
    if (before) {
      console.error(`${dir}/${name} 이 ${before}/${name} 과 같은 이름입니다 — R2 에서 한쪽이 덮입니다.`);
      process.exit(1);
    }
    seen.set(name, dir);
    files.push({ dir, name });
  }
}

if (files.length === 0) {
  console.error(`${SOURCES.join("/, ")}/ 에 올릴 파일이 없습니다 — npm run optimize 를 먼저 실행하세요.`);
  process.exit(1);
}

if (dryRun) {
  console.log(`[dry-run] 올릴 파일 ${files.length}개:`);
  for (const { dir, name } of files) console.log(`  ${dir}/${name}`);
  process.exit(0);
}

const env = requireEnv();
const bucket = env.R2_BUCKET;
const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

let total = 0;
for (const { dir, name } of files) {
  const full = path.join(dir, name);
  const body = await readFile(full);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: name,
      Body: body,
      ContentType: CONTENT_TYPES[path.extname(name).toLowerCase()],
      CacheControl: CACHE_CONTROL,
    }),
  );
  const { size } = await stat(full);
  total += size;
  console.log(`↑ ${name} (${(size / 1024).toFixed(0)}KB)`);
}

console.log(`완료: ${files.length}개, 총 ${(total / 1024).toFixed(0)}KB → ${bucket}`);
console.log("VITE_IMAGE_BASE_URL 이 이 버킷의 공개 URL 을 가리키는지 확인하세요.");
