import { execFileSync } from "node:child_process";
import path from "node:path";

const BRANCH_MODE = process.argv.includes("--branch");
const BASE = process.env.REVIEW_BASE || process.env.GITHUB_BASE_REF || "develop";
const MAX_NEW_FILE_BYTES = 1024 * 1024;
const PR_SIZE_WARN = 400;
const PR_SIZE_SPLIT = 800;

const SKIP_ALL = (f) => f.startsWith("drafts/");

const SKIP_PII = (f) => f === "src/invite.ts";

const SELF = new Set(["scripts/review-guard.mjs", "scripts/review-guard.test.mjs", "docs/REVIEW.md"]);

const FORBIDDEN_PATHS = [
  { test: (f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".env.example"), why: "환경변수 파일 — 시크릿이 들어 있다" },
  { test: (f) => path.basename(f) === ".DS_Store", why: "macOS 메타파일" },
  { test: (f) => /\.(pem|key|p12|pfx)$/i.test(f), why: "인증서·개인키" },
  { test: (f) => /(^|\/)id_rsa/.test(f), why: "SSH 개인키" },
  { test: (f) => f.startsWith("photos-original/"), why: "사진 원본 — 최적화 산출물(WebP)만 커밋한다" },
  { test: (f) => f.startsWith("public/images/mock/"), why: "mock 이미지 — 배포에 섞이면 안 된다" },
  {
    test: (f) => /\.(jpe?g|png|heic)$/i.test(f) && f !== "public/og-image.jpg",
    why: "래스터 원본 — WebP로 변환해 커밋한다 (og-image.jpg만 예외)",
  },
];

const SECRET_RULES = [
  { name: "Google API 키", re: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Apps Script 배포 URL", re: /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/g },
  { name: "Kakao 앱 키", re: /(kakao|KAKAO)[^\n]{0,40}[0-9a-f]{32}/g },
  { name: "개인키 블록", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    name: "하드코딩된 시크릿",
    re: /(secret|token|password|api[_-]?key)\s*[:=]\s*["'][^"'\s]{8,}["']/gi,
    ignore: (m) => /import\.meta\.env|process\.env/.test(m),
  },
];

const PII_RULES = [
  { name: "휴대폰 번호", re: /\b01[016-9][-. ]?\d{3,4}[-. ]?\d{4}\b/g },
  { name: "주민등록번호", re: /\b\d{6}-\d{7}\b/g },
  { name: "계좌번호", re: /\b(?:\d{2,6}-){2,3}\d{2,8}\b/g },
];

const DATE_PATTERNS = [/(?<![\d-])\d{4}-\d{2}-\d{2}(?![\d-])/g, /(?<!\d)\d{4}\s?\.\s?\d{1,2}\s?\.\s?\d{1,2}(?!\d)/g];

export function maskDates(text) {
  return DATE_PATTERNS.reduce((t, re) => t.replace(re, (m) => "\0".repeat(m.length)), text);
}

const EXAMPLE_NUMBERS = new Set(["01012345678", "0212345678", "021234567", "0311234567"]);

function isPlaceholder(s) {
  const digits = s.replace(/\D/g, "");
  return new Set(digits).size === 1 || EXAMPLE_NUMBERS.has(digits);
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

export function scanText(text, file) {
  if (SKIP_ALL(file) || SELF.has(file)) return [];
  const findings = [];

  for (const { name, re, ignore } of SECRET_RULES) {
    for (const m of text.matchAll(re)) {
      if (ignore?.(m[0])) continue;
      findings.push({ kind: "시크릿", rule: name, line: lineOf(text, m.index), hint: redact(m[0]) });
    }
  }

  if (!SKIP_PII(file)) {
    let remaining = maskDates(text);
    for (const { name, re } of PII_RULES) {
      const hits = [...remaining.matchAll(re)];
      for (const m of hits) {
        if (isPlaceholder(m[0])) continue;
        findings.push({ kind: "개인정보", rule: name, line: lineOf(text, m.index), hint: redact(m[0]) });
      }
      for (const m of hits) {
        remaining = remaining.slice(0, m.index) + "\0".repeat(m[0].length) + remaining.slice(m.index + m[0].length);
      }
    }
  }

  return findings;
}

function redact(s) {
  return s.length <= 6 ? "*".repeat(s.length) : `${s.slice(0, 3)}${"*".repeat(s.length - 5)}${s.slice(-2)}`;
}

export function forbiddenReason(file) {
  if (SKIP_ALL(file)) return null;
  return FORBIDDEN_PATHS.find(({ test }) => test(file))?.why ?? null;
}

function git(args, { binary = false } = {}) {
  return execFileSync("git", args, {
    encoding: binary ? "buffer" : "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function tryGit(args, opts) {
  try {
    return git(args, opts);
  } catch {
    return null;
  }
}

function baseRef() {
  if (tryGit(["rev-parse", "--verify", "--quiet", BASE])) return BASE;
  if (tryGit(["rev-parse", "--verify", "--quiet", `origin/${BASE}`])) return `origin/${BASE}`;
  return null;
}

function changedFiles(base) {
  const args = BRANCH_MODE
    ? ["diff", "--name-only", "--diff-filter=ACM", `${base}...HEAD`]
    : ["diff", "--cached", "--name-only", "--diff-filter=ACM"];
  return (tryGit(args) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readBlob(file) {
  return tryGit(["show", BRANCH_MODE ? `HEAD:${file}` : `:${file}`], { binary: true });
}

function isBinary(buf) {
  return buf.subarray(0, 8000).includes(0);
}

function run() {
  const base = baseRef();
  if (BRANCH_MODE && !base) {
    console.error(`검토 게이트: 비교 대상 '${BASE}' 브랜치를 찾을 수 없습니다.`);
    process.exit(1);
  }

  const files = changedFiles(base);
  const blocking = [];
  const warnings = [];

  for (const file of files) {
    const reason = forbiddenReason(file);
    if (reason) {
      blocking.push(`${file} — 금지 파일: ${reason}`);
      continue;
    }

    const buf = readBlob(file);
    if (!buf) continue;

    if (buf.length > MAX_NEW_FILE_BYTES) {
      blocking.push(`${file} — ${(buf.length / 1024 / 1024).toFixed(2)}MB (1MB 초과). 리포에 넣지 말 것`);
      continue;
    }
    if (isBinary(buf)) continue;

    for (const f of scanText(buf.toString("utf8"), file)) {
      blocking.push(`${file}:${f.line} — ${f.kind}(${f.rule}): ${f.hint}`);
    }
  }

  if (BRANCH_MODE) {
    const log = tryGit(["log", `${base}..HEAD`, "--format=%H%n%B%n---"]) ?? "";
    for (const f of scanText(log, "<커밋 메시지>")) {
      blocking.push(`커밋 메시지 — ${f.kind}(${f.rule}): ${f.hint}`);
    }
  }

  if (BRANCH_MODE) {
    const numstat = tryGit(["diff", "--numstat", `${base}...HEAD`]) ?? "";
    let lines = 0;
    for (const row of numstat.split("\n").filter(Boolean)) {
      const [add, del, file] = row.split("\t");
      if (!file || file === "package-lock.json" || file.startsWith("public/images/") || file.startsWith("dist/")) continue;
      lines += (Number(add) || 0) + (Number(del) || 0);
    }
    if (lines > PR_SIZE_SPLIT) {
      warnings.push(`diff ${lines}줄 — ${PR_SIZE_SPLIT}줄 초과. PR을 나누거나 본문에 사유를 적어주세요`);
    } else if (lines > PR_SIZE_WARN) {
      warnings.push(`diff ${lines}줄 — 권장 ${PR_SIZE_WARN}줄을 넘었습니다`);
    }
  }

  for (const w of warnings) console.warn(`검토 게이트 경고: ${w}`);

  if (blocking.length > 0) {
    console.error("\n검토 게이트 실패 — 아래를 해결하기 전에는 커밋할 수 없습니다:");
    for (const b of blocking) console.error(`  - ${b}`);
    console.error("\n고객 정보는 src/invite.ts 에만 둡니다. 자세한 기준은 docs/REVIEW.md 참고.\n");
    process.exit(1);
  }

  console.log(`검토 게이트 통과 (${files.length}개 파일 검사${warnings.length ? `, 경고 ${warnings.length}건` : ""})`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("review-guard.mjs")) run();
