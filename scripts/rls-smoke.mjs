// SIS-33 — RLS 정책 스모크. `npm run smoke:rls`
//
// supabase/schema.sql 을 적용한 뒤 한 번 돌려, 정책이 의도대로 걸렸는지 확인한다.
// 확인하는 것은 두 가지다.
//
//   1. 읽기가 막혔는가 — 참석 명단은 하객에게 비공개다.
//   2. 쓰기가 열렸는가 — 막혀 있으면 회신이 통째로 유실된다.
//
// 2번이 까다롭다. 진짜 행을 넣어 보면 확인은 되지만 테스트 데이터가 남고, 지우려면
// delete 권한이 필요한데 그 권한은 열지 않았다. 그래서 **check 제약을 일부러
// 위반하는 페이로드**를 보낸다. RLS 가 막으면 42501, RLS 를 통과한 뒤 제약에
// 걸리면 23514 다. 23514 가 오면 insert 정책을 통과했다는 뜻이고 행은 남지 않는다.
//
// 클라이언트가 실제로 쓰는 라이브러리(@supabase/supabase-js)로 부른다. publishable
// 키를 이 버전이 받아들이는지도 여기서 함께 드러난다.
import { createClient } from "@supabase/supabase-js";
import { readEnvFile, envValue } from "./read-env.mjs";

const envFile = await readEnvFile();
const url = envValue("VITE_SUPABASE_URL", envFile);
const key = envValue("VITE_SUPABASE_PUBLISHABLE_KEY", envFile);

if (!url || !key) {
  console.error("VITE_SUPABASE_URL·VITE_SUPABASE_PUBLISHABLE_KEY 가 필요합니다 (.env 확인)");
  process.exit(1);
}
if (key.startsWith("sb_secret_")) {
  // 시크릿 키로 돌리면 RLS 를 우회해 전부 통과한다. 통과했다는 사실이 아무것도
  // 증명하지 못하므로, 잘못된 안심을 주기 전에 멈춘다.
  console.error("secret 키로는 RLS 를 검증할 수 없습니다 — 우회되어 무조건 통과합니다. publishable 키로 돌리세요");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const failures = [];

/** 테이블 자체가 없을 때의 오류. 두 검사 모두 여기서 걸리므로 한 번만 보고한다. */
const isMissingTable = (error) => error?.code === "42P01" || error?.code === "PGRST205";

// ── 1. select 가 막혀 있는가 ────────────────────────────────────────────────
// 주의: 권한 오류(42501)가 아니라 **빈 결과**가 정상이다. RLS 는 정책에 맞지 않는
// 행을 걸러 내는 방식이라, select 정책이 없으면 0건이 온다.
{
  const { data, error } = await supabase.from("rsvp").select("id").limit(1);
  if (isMissingTable(error)) {
    console.error("rsvp 테이블이 없습니다 — supabase/schema.sql 을 SQL Editor 에서 실행한 뒤 다시 돌리세요");
    process.exit(1);
  }
  if (error) {
    if (error.code === "42501") {
      // 이것도 읽기가 막힌 상태이긴 하다. 다만 예상한 경로가 아니라 알린다.
      console.log("① 읽기 차단 — 통과 (권한 오류로 차단됨: grant 가 좁게 잡혀 있습니다)");
    } else {
      failures.push(`select 에서 예상 못한 오류: ${error.code} ${error.message}`);
    }
  } else if (data && data.length > 0) {
    failures.push("select 로 응답이 읽힙니다 — 참석 명단이 하객에게 노출됩니다. select 정책을 제거하세요");
  } else {
    console.log("① 읽기 차단 — 통과 (0건)");
  }
}

// ── 2. insert 가 열려 있는가 ───────────────────────────────────────────────
{
  // meal 만 제약을 위반시킨다. 나머지는 정상값이라, 23514 가 왔다는 것은
  // "여기까지 왔다"는 뜻이 된다.
  const { error } = await supabase.from("rsvp").insert({
    side: "신랑측",
    attend: "참석",
    name: "RLS스모크",
    count: 1,
    meal: "__제약위반__",
  });

  if (!error) {
    failures.push("제약을 위반한 행이 저장되었습니다 — check 제약이 빠져 있습니다. 테이블에서 해당 행을 지우세요");
  } else if (error.code === "23514") {
    console.log("② 쓰기 허용 — 통과 (insert 정책 통과 후 check 위반 23514, 행은 남지 않음)");
  } else if (error.code === "42501") {
    failures.push("insert 가 RLS 에 막힙니다(42501) — rsvp_insert_only 정책이 없거나 마감일 조건이 이미 지났습니다");
  } else {
    failures.push(`insert 에서 예상 못한 오류: ${error.code} ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error("\nRLS 스모크 실패:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nRLS 스모크 통과 — 읽기 차단·쓰기 허용 확인");
