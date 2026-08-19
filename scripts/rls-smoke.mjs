// SIS-33 — RLS 정책 스모크. `npm run smoke:rls`
//
// supabase/schema.sql 을 적용한 뒤 한 번 돌려, 정책이 의도대로 걸렸는지 확인한다.
// 확인하는 것은 네 가지다.
//
//   1. 읽기가 막혔는가 — 참석 명단은 하객에게 비공개다.
//   2. 쓰기가 열렸는가 — 막혀 있으면 회신이 통째로 유실된다.
//   3. 관리자 명단(admin_users)이 감춰졌는가 — 관리자 uuid 가 노출될 이유가 없다.
//   4. is_admin() 을 anon 이 부를 수 없는가 (SIS-22).
//
// 3·4 는 관리자 페이지(SIS-22)가 select 정책을 열면서 생긴 검사다. **이 스모크는
// 로그인하지 않은 하객의 시선으로만 본다** — publishable 키로 돌기 때문이다. 즉
// 관리자가 실제로 읽을 수 있는지는 여기서 확인되지 않는다. 그쪽은 /admin 에
// 로그인해 목록이 뜨는지로 확인한다(docs/manual-qa.md).
//
// 2번이 까다롭다. 진짜 행을 넣어 보면 확인은 되지만 테스트 데이터가 남고, 지우려면
// delete 권한이 필요한데 그 권한은 열지 않았다. 그래서 **check 제약을 일부러
// 위반하는 페이로드**를 보낸다. RLS 가 막으면 42501, RLS 를 통과한 뒤 제약에
// 걸리면 23514 다. 23514 가 오면 insert 정책을 통과했다는 뜻이고 행은 남지 않는다.
//
// ⚠ 이 판정은 Postgres 가 RLS WITH CHECK 를 테이블 CHECK 제약보다 먼저 평가한다는
// 전제 위에 있다. 순서가 반대라면 정책이 없어져도 23514 가 돌아와 「통과」로
// 보일 수 있다. 즉 이 스모크는 **정책이 살아 있음을 강하게 시사할 뿐 증명하지는
// 않는다.** 실제 회신이 저장되는지는 SIS-20 이후 폼으로 한 건 넣어 보고
// 대시보드에서 확인하는 것이 최종 확인이다(docs/manual-qa.md).
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
// 행을 걸러 내는 방식이라, 이 롤에 맞는 select 정책이 없으면 0건이 온다.
//
// SIS-22 로 rsvp 에 select 정책이 생겼지만 `to authenticated` + is_admin() 이라
// anon 에는 걸리지 않는다. 여기서 행이 보인다면 그 정책이 anon 까지 열렸다는 뜻이다.
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
    failures.push(
      "select 로 응답이 읽힙니다 — 참석 명단이 하객에게 노출됩니다. " +
        "rsvp_admin_select 가 anon 까지 열려 있지 않은지 확인하세요 (for select to authenticated using (is_admin()))",
    );
  } else {
    console.log("① 읽기 차단 — 통과 (0건)");
  }
}

// ── 2. insert 가 열려 있는가 ───────────────────────────────────────────────
{
  // meal 만 제약을 위반시킨다. 나머지는 정상값이라, 23514 가 왔다는 것은
  // "여기까지 왔다"는 뜻이 된다.
  //
  // 위반값으로 **옛 저장값 '식사'** 를 쓴다(SIS-35). 아무 문자열이나 넣어도 insert
  // 정책 확인은 되지만, 그러면 이 검사가 meal 마이그레이션 적용 여부와 무관하게
  // 늘 똑같이 통과한다 — schema.sql 의 meal alter 블록은 대시보드에서 손으로
  // 돌려야 하는 단계라 빠뜨리기 쉽고, 빠뜨리면 폼이 보내는 '식사함' 이 옛 제약에
  // 걸려 **참석 회신만** 전부 23514 로 거부된다. 미참석은 '식사안함' 이라 양쪽
  // 제약을 모두 통과하므로 대시보드에 행이 쌓이는 것만 봐서는 알아채지 못한다.
  //
  // '식사' 를 쓰면 두 경우가 갈린다.
  //   새 제약이 걸려 있다 → 거부(23514). 행은 남지 않고, alter 가 적용된 것이다
  //   옛 제약이거나 제약이 없다 → 저장됨. 아래 !error 가지가 잡는다
  //
  // phone 을 굳이 실어 보내는 이유는 컬럼 누락을 잡기 위해서다. 옛 SQL 로 만든
  // 테이블에는 phone 이 없고, 그 상태로는 회신의 연락처가 통째로 버려진다.
  // 없는 컬럼을 보내면 PostgREST 가 PGRST204 로 알려 준다.
  //
  // 값이 전부 0 인 것은 검토 게이트 때문이다. 진짜 형식의 번호를 적으면 개인정보
  // 패턴에 걸려 커밋이 막힌다(scripts/review-guard.mjs).
  const { error } = await supabase.from("rsvp").insert({
    side: "신랑측",
    attend: "참석",
    name: "RLS스모크",
    count: 1,
    meal: "식사",
    phone: "00000000000",
  });

  if (!error) {
    failures.push(
      "옛 저장값 '식사' 가 그대로 저장되었습니다 — meal 제약이 없거나 옛 상태입니다. " +
        "supabase/schema.sql 의 meal alter 블록(SIS-35)을 실행하고, 방금 저장된 RLS스모크 행을 지우세요. " +
        "이대로 두면 참석 회신만 전부 23514 로 거부됩니다",
    );
  } else if (error.code === "PGRST204") {
    failures.push(`테이블에 없는 컬럼이 있습니다 (${error.message}) — supabase/schema.sql 의 alter table 부분을 실행하세요`);
  } else if (error.code === "23514") {
    console.log("② 쓰기 허용 — 통과 (insert 정책 통과 후 check 위반 23514, 행은 남지 않음. meal 제약도 새 값 기준)");
  } else if (error.code === "42501") {
    failures.push("insert 가 RLS 에 막힙니다(42501) — rsvp_insert_only 정책이 없거나 마감일 조건이 이미 지났습니다");
  } else {
    failures.push(`insert 에서 예상 못한 오류: ${error.code} ${error.message}`);
  }
}

// ── 3. 관리자 명단이 감춰져 있는가 (SIS-22) ────────────────────────────────
// admin_users 는 RLS 를 켜 두고 정책을 하나도 만들지 않았다. anon 에게는 늘 0건이다.
// 여기서 행이 보이면 누군가 정책을 열었다는 뜻이고, 관리자 uuid 가 그대로 나간다.
{
  const { data, error } = await supabase.from("admin_users").select("user_id").limit(1);
  if (isMissingTable(error)) {
    failures.push("admin_users 테이블이 없습니다 — supabase/schema.sql 의 「관리자 접근(SIS-22)」 구역을 실행하세요");
  } else if (error) {
    if (error.code === "42501") {
      console.log("③ 관리자 명단 차단 — 통과 (권한 오류로 차단됨)");
    } else {
      failures.push(`admin_users select 에서 예상 못한 오류: ${error.code} ${error.message}`);
    }
  } else if (data && data.length > 0) {
    failures.push("admin_users 가 anon 에게 읽힙니다 — 관리자 uuid 가 노출됩니다. 이 테이블에는 정책을 만들지 않습니다");
  } else {
    console.log("③ 관리자 명단 차단 — 통과 (0건)");
  }
}

// ── 4. is_admin() 을 anon 이 부를 수 없는가 (SIS-22) ───────────────────────
// schema.sql 이 anon 의 execute 를 걷어낸다. 막히는 것이 정상이고, 설령 불리더라도
// auth.uid() 가 null 이라 false 여야 한다. true 가 돌아오면 로그인 없이 관리자로
// 통과한다는 뜻이라 관리자 정책 전체가 무력해진다.
{
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    if (error.code === "42501" || error.code === "PGRST202") {
      // PGRST202 는 「함수를 찾을 수 없음」이기도 해서 권한 차단과 구별되지 않는다.
      // 다만 **함수가 없으면 정책이 애초에 만들어지지 않는다** — rsvp_admin_select 가
      // using (is_admin()) 으로 그 함수를 참조하므로, 함수가 빠진 채 정책만 남는
      // 상태는 생길 수 없다. 그래서 차단으로 본다.
      console.log("④ is_admin() 차단 — 통과 (anon 은 호출할 수 없음)");
    } else {
      failures.push(`is_admin() 호출에서 예상 못한 오류: ${error.code} ${error.message}`);
    }
  } else if (data === true) {
    failures.push("is_admin() 이 로그인 없이 true 를 돌려줍니다 — 관리자 정책이 통째로 무력합니다");
  } else {
    failures.push(
      "is_admin() 을 anon 이 호출할 수 있습니다 — `revoke execute on function is_admin() from anon, public` 을 실행하세요. " +
        "**두 롤을 모두 적어야 합니다**(SIS-39): Postgres 가 PUBLIC 에, Supabase 의 default privileges 가 anon 에 각각 " +
        "EXECUTE 를 주므로 한쪽만 걷으면 다른 쪽이 남습니다. " +
        "방금 실행했다면 PostgREST 의 스키마 캐시가 갱신되도록 몇 초 뒤 다시 돌려 보세요",
    );
  }
}

if (failures.length > 0) {
  console.error("\nRLS 스모크 실패:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nRLS 스모크 통과 — 하객(anon) 기준 읽기 차단·쓰기 허용, 관리자 경로 차단 확인");
