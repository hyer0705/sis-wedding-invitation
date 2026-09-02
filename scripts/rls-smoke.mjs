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
  console.error("secret 키로는 RLS 를 검증할 수 없습니다 — 우회되어 무조건 통과합니다. publishable 키로 돌리세요");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const failures = [];

const isMissingTable = (error) => error?.code === "42P01" || error?.code === "PGRST205";

{
  const { data, error } = await supabase.from("rsvp").select("id").limit(1);
  if (isMissingTable(error)) {
    console.error("rsvp 테이블이 없습니다 — supabase/schema.sql 을 SQL Editor 에서 실행한 뒤 다시 돌리세요");
    process.exit(1);
  }
  if (error) {
    if (error.code === "42501") {
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

{
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

{
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    if (error.code === "42501" || error.code === "PGRST202") {
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

{
  const { error } = await supabase.from("guestbook").select("id, name, message, created_at").limit(1);
  if (isMissingTable(error)) {
    failures.push("guestbook 테이블이 없습니다 — supabase/schema.sql 의 「방명록(SIS-21)」 구역을 실행하세요");
  } else if (error) {
    failures.push(
      `방명록을 하객이 읽지 못합니다 (${error.code} ${error.message}) — 화면에 목록이 늘 비어 보입니다. ` +
        "guestbook_public_select 정책과 컬럼 grant 를 확인하세요",
    );
  } else {
    console.log("⑤ 방명록 읽기 허용 — 통과");
  }
}

{
  const { data, error } = await supabase.from("guestbook").select("password_hash").limit(1);
  if (error) {
    if (error.code === "42501" || error.code === "PGRST100" || error.code === "PGRST204") {
      console.log("⑥ password_hash 차단 — 통과");
    } else {
      failures.push(`password_hash select 에서 예상 못한 오류: ${error.code} ${error.message}`);
    }
  } else {
    failures.push(
      "password_hash 가 하객에게 읽힙니다 — 비밀번호 삭제(GB-02)가 무력해집니다. " +
        "`revoke all on guestbook from anon, authenticated` 뒤에 컬럼 단위 grant 를 실행했는지 확인하세요. " +
        (data && data.length > 0
          ? "이미 노출된 글이 있으므로 비밀번호를 새로 받아야 합니다"
          : "아직 글이 없어 실제 유출은 없습니다"),
    );
  }
}

{
  const { error } = await supabase.from("guestbook").insert({ name: "RLS스모크", message: "직접 insert 차단 확인" });
  if (!error) {
    failures.push(
      "방명록에 직접 insert 가 됩니다 — 해시를 우회해 글을 넣을 수 있습니다. " +
        "insert 정책을 만들지 않았는지, 테이블 grant 를 걷어냈는지 확인하고 방금 저장된 RLS스모크 행을 지우세요",
    );
  } else if (error.code === "42501" || error.code === "PGRST204") {
    console.log("⑦ 직접 insert 차단 — 통과");
  } else {
    failures.push(`방명록 insert 에서 예상 못한 오류: ${error.code} ${error.message}`);
  }
}

{
  const { error } = await supabase.rpc("create_guestbook_entry", {
    entry_name: "RLS스모크",
    entry_message: "작성 RPC 확인",
    entry_password: "1",
  });

  if (!error) {
    failures.push(
      "4자 미만 비밀번호가 그대로 통과했습니다 — create_guestbook_entry 의 길이 가드가 없습니다. " +
        "supabase/schema.sql 의 방명록 구역을 다시 실행하고, 방금 저장된 RLS스모크 글을 대시보드에서 지우세요",
    );
  } else if (error.code === "22023") {
    console.log("⑧ 작성 RPC 호출 가능 — 통과 (길이 가드 22023, 글은 남지 않음)");
  } else if (error.code === "42501" || error.code === "PGRST202") {
    failures.push(
      "작성 RPC 를 하객이 부를 수 없습니다 — 축하 메시지를 아무도 남기지 못합니다. " +
        "`grant execute on function create_guestbook_entry(text, text, text) to anon` 을 실행하세요. " +
        "방금 실행했다면 PostgREST 의 스키마 캐시가 갱신되도록 몇 초 뒤 다시 돌려 보세요",
    );
  } else {
    failures.push(`create_guestbook_entry 에서 예상 못한 오류: ${error.code} ${error.message}`);
  }
}

{
  const { data, error } = await supabase.rpc("delete_guestbook_entry", {
    entry_id: "00000000-0000-0000-0000-000000000000",
    entry_password: "0000",
  });

  if (error) {
    if (error.code === "42501" || error.code === "PGRST202") {
      failures.push(
        "삭제 RPC 를 하객이 부를 수 없습니다 — 본인 글을 지울 수 없습니다(GB-02). " +
          "`grant execute on function delete_guestbook_entry(uuid, text) to anon` 을 실행하세요",
      );
    } else {
      failures.push(`delete_guestbook_entry 에서 예상 못한 오류: ${error.code} ${error.message}`);
    }
  } else if (data === false) {
    console.log("⑨ 삭제 RPC 호출 가능 — 통과 (없는 글은 false)");
  } else {
    failures.push(`delete_guestbook_entry 가 없는 글에 ${JSON.stringify(data)} 를 돌려줍니다 — false 여야 합니다`);
  }
}

if (failures.length > 0) {
  console.error("\nRLS 스모크 실패:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  "\nRLS 스모크 통과 — 하객(anon) 기준 회신은 읽기 차단·쓰기 허용, 방명록은 읽기 허용·해시 차단, 관리자 경로 차단 확인",
);
