-- SIS-33 — RSVP 수신용 Supabase 스키마. Supabase 대시보드의 SQL Editor 에 붙여 실행한다.
--
-- 이 파일이 스키마의 단일 기준이다. 대시보드에서 손으로 컬럼을 고치지 않는다 —
-- 고치면 이 파일과 실제 DB 가 어긋나고, 어긋난 것을 알아챌 방법이 없다.
--
-- **파일 전체를 복사해 한 번 Run 하면 된다.** 처음 만들 때도, 이미 만들어 둔 뒤에도
-- 같다. 여러 번 실행해도 안전하다.
--
-- 한 가지 예외가 있다. phone 이 비어 있는 행이 남아 있으면 아래 `alter column phone
-- set not null` 에서 멈춘다(23502, SIS-37). 데이터에 달린 실패라 파일을 고쳐서
-- 넘길 수 있는 것이 아니다 — 그 행을 어떻게 할지 먼저 정한다.
--
-- 다만 그 안전함이 create table 에서 오는 것은 아니다. rsvp 가 이미 있으면 create
-- table 은 통째로 건너뛰므로 **컬럼과 제약은 옛 상태 그대로 남고 오류도 나지 않는다.**
-- 기존 테이블을 실제로 갱신하는 것은 그 아래 「이미 rsvp 를 만든 뒤라면」 구역의
-- alter·update 구문들이다. 그래서 컬럼이나 제약을 바꿀 때는 **create table 만 고치지
-- 말고 반드시 그 구역에도 같은 변경을 얹는다** — create table 만 고치면 새 프로젝트와
-- 운영 중인 프로젝트의 모양이 조용히 갈라진다.
--
-- 실행한 뒤에는 `npm run smoke:rls` 로 확인한다. 마이그레이션이 빠졌는지까지 본다.
-- (초안 SQL 로 이미 만들어 둔 테이블이 있다면, 아직 응답이 없을 때 drop table rsvp
--  로 지우고 이 파일을 처음부터 실행하는 편이 확실하다.)
--
-- 방명록(SIS-21)은 같은 프로젝트에 테이블을 더 얹는다. 이 파일에는 RSVP 와
-- 관리자 접근(SIS-22)만 둔다.

create table if not exists rsvp (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('신랑측', '신부측')),
  attend text not null check (attend in ('참석', '미참석')),
  name text not null check (char_length(name) between 1 and 20),
  count int not null check (count between 1 and 20),
  -- 식사 여부 3택 (고객 확정 2026-08-18 — B안).
  --
  -- 허용값 제약은 이름을 붙여 아래에 따로 건다(SIS-35). 여기 인라인으로 적으면
  -- Postgres 가 rsvp_meal_check 로 자동 명명하는데, 이름을 우리가 모르면 나중에
  -- drop constraint 로 갈아끼울 수가 없다. phone 이 같은 이유로 이미 밖에 나가 있다.
  meal text not null,
  -- 연락처 (고객 요청 2026-08-18). 제출자 대표 연락처 한 개를 받는다.
  --
  -- **참석·미참석을 가리지 않고 필수다** (SIS-37). SIS-35 에서는 미참석만 선택으로
  -- 두었었다 — 못 간다고 알려주려는 하객을 연락처에서 막으면 회신 자체를 포기한다고
  -- 보았기 때문이다. 고객이 그 판단을 뒤집었다: 축의 대조·답례·회신 정정에 그 번호
  -- 말고는 창구가 없고, 미참석 회신도 같은 이유로 연락이 필요하다.
  --
  -- 되돌리려면 여기 not null 과 아래 alter column 을 함께 걷어낸다. 둘 중 하나만
  -- 고치면 새 프로젝트와 운영 중인 프로젝트가 갈라진다.
  --
  -- 형식 제약은 이름을 붙여 아래에 따로 건다. 여기 인라인으로 적으면 새로 만든
  -- 경우에만 이름 없는 제약이 하나 더 생겨 둘이 겹친다.
  phone text not null,
  created_at timestamptz not null default now()
);

-- 「전하고 싶은 말」 컬럼은 두지 않는다. 방명록(SIS-21)이 같은 역할을 하므로
-- 받지 않기로 고객이 확정했다(2026-08-18).
--
-- ★ 연락처를 받기로 하면서 이 테이블은 개인정보를 담게 됐다. 두 가지가 따라온다.
--   1. 개인정보 동의 문구(RS-03)의 수집 항목에 연락처가 반드시 들어가야 한다.
--      법적 요구사항이라 문구는 고객 확정본을 쓴다 — 지어 넣지 않는다.
--   2. 명세서(RS-01)는 「연락처 미수집」으로 되어 있다. 시트를 갱신해야 코드와
--      단일 기준이 맞는다.
--
-- ── 이미 rsvp 를 만든 뒤라면 ────────────────────────────────────────────────
-- 위 create table 은 테이블이 있으면 통째로 건너뛴다. 아래 구문들이 그 경우를
-- 메운다. 새로 만든 경우에도 그냥 통과하므로 항상 함께 실행하면 된다.
alter table rsvp add column if not exists phone text;

-- 식사 여부의 저장값을 화면 라벨과 같게 맞춘다 (SIS-35). '식사' → '식사함'.
--
-- **세 구문의 순서가 중요하다.** 옛 제약을 먼저 걷어내지 않으면 update 가 그 제약에
-- 걸려(23514) 통째로 실패한다 — '식사함' 은 옛 허용값 목록에 없다. 반대로 새 제약을
-- 먼저 걸어도 남아 있는 '식사' 행 때문에 add constraint 자체가 거부된다.
--   1) 옛 이름 없는 제약을 뗀다 (Postgres 가 rsvp_meal_check 로 자동 명명해 두었다)
--   2) 남아 있는 행의 값을 옮긴다
--   3) 이름 붙인 새 제약을 건다
-- 테이블을 처음 만드는 경우에는 1) 이 그냥 통과하고 2) 가 0건이라 그대로 이어진다.
alter table rsvp drop constraint if exists rsvp_meal_check;
update rsvp set meal = '식사함' where meal = '식사';
alter table rsvp drop constraint if exists rsvp_meal_allowed;
alter table rsvp add constraint rsvp_meal_allowed check (meal in ('식사함', '식사안함', '미정'));

-- 형식: 숫자와 하이픈만 9~13자. 휴대폰·집전화·하이픈 유무가 섞여 들어오므로
-- 넓게 잡았고, 정규화는 SIS-15 의 폼이 한다.
alter table rsvp drop constraint if exists rsvp_phone_format;
alter table rsvp add constraint rsvp_phone_format check (phone ~ '^[0-9-]{9,13}$');

-- 연락처는 모든 회신에 있어야 한다 (SIS-37). 화면(SIS-15)에서도 막지만 여기서
-- 한 번 더 닫는다 — 응답 마감일을 RLS 정책으로 닫은 것과 같은 이유다. 클라이언트
-- 검증만 믿으면 코드가 바뀌는 순간 조용히 빈 값이 쌓이고, 그때는 예식이 코앞이라
-- 다시 받을 방법이 없다.
--
-- 참석에만 걸던 check 제약을 걷어내고 컬럼 자체의 not null 로 옮긴다. 「미참석은
-- 예외」라는 조건이 사라진 마당에 제약으로 표현할 것이 남지 않는다.
--
-- **phone 이 빈 행이 남아 있으면 아래 set not null 이 실패한다.** 그것이 옳은
-- 동작이다 — 조용히 넘어가면 필수라고 믿는 채로 빈 값이 섞인 명단을 쓰게 된다.
-- 실패하면 그 행을 어떻게 할지(번호를 채울지, 지울지) 먼저 정하고 다시 실행한다.
alter table rsvp drop constraint if exists rsvp_phone_required_for_attendees;
alter table rsvp alter column phone set not null;

alter table rsvp enable row level security;

-- anon 롤에 insert 만 연다. select·update·delete 정책은 만들지 않는다.
--
-- RLS 는 기본 거부이므로 정책이 없는 동작은 그대로 막힌다. 다만 **select 는
-- 에러가 아니라 빈 결과로 나타난다** — PostgREST 가 권한 오류를 내는 것이 아니라
-- 정책에 걸린 행이 전부 걸러져 0건이 온다. scripts/rls-smoke.mjs 가 이 점을
-- 전제로 검증한다.
--
-- 참석 명단은 하객에게 비공개다. 응답을 읽는 것은 관리자(SIS-22)의 몫이며,
-- 그때도 anon 에 select 를 열지 않고 별도 인증 경로를 쓴다.
drop policy if exists rsvp_insert_only on rsvp;
create policy rsvp_insert_only on rsvp
  for insert to anon
  -- 응답 마감(시트 확정 2027-01-23) 다음 날 0시부터 insert 를 막는다.
  -- 클라이언트 검증만으로는 마감이 강제되지 않으므로 DB 에서 닫는다.
  with check (now() < '2027-01-24T00:00:00+09:00');

-- 관리자 페이지(SIS-22)가 최신순으로 읽는다. 지금은 행이 적지만 인덱스를
-- 나중에 붙이면 그때 잠깐 잠기므로 처음부터 만들어 둔다.
create index if not exists rsvp_created_at_idx on rsvp (created_at desc);

-- ── 관리자 접근 (SIS-22) ───────────────────────────────────────────────────
--
-- 여기서부터가 관리자 페이지(/admin)가 응답을 읽고 지우기 위한 부분이다.
-- **anon 은 끝까지 아무것도 읽지 못한다** — 위 rsvp_insert_only 는 그대로 두고,
-- 로그인한 관리자에게만 별도 정책을 연다.
--
-- ⚠ **`to authenticated` 만으로는 부족하다.** Supabase 는 기본적으로 이메일
-- 회원가입이 열려 있어, 번들에 박힌 publishable 키로 아무나 signUp 을 부르면
-- 그 순간 `authenticated` 가 된다. 그 상태로 select 가 열려 있으면 하객 명단이
-- 통째로 나간다. 그래서 두 겹으로 막는다.
--
--   1. 대시보드에서 **회원가입을 끈다** (Authentication → Sign In / Providers →
--      Email → "Allow new users to sign up" 해제). 계정은 대시보드에서만 만든다
--   2. 아래 admin_users 에 등록된 사용자만 통과시킨다 — 1 이 실수로 다시 켜져도
--      명단은 열리지 않는다
--
-- 관리자 계정의 이메일은 이 파일에 적지 않는다. 개인정보를 리포에 남기지 않기
-- 위해서이며(CLAUDE.md), 그래서 이메일이 아니라 **uuid** 로 등록한다.

-- 관리자로 인정할 사용자. 대시보드에서 계정을 만든 뒤 그 uuid 를 한 줄 넣는다.
--
--   insert into admin_users (user_id) values ('<Authentication → Users 의 UID>');
--
-- auth.users 를 참조하므로 계정을 지우면 이 행도 함께 사라진다.
create table if not exists admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 이 테이블은 아무에게도 열지 않는다. RLS 를 켜고 정책을 하나도 만들지 않으면
-- anon·authenticated 양쪽 모두 0건을 본다. 등록·해제는 대시보드(service role)가
-- RLS 를 우회해 처리한다.
alter table admin_users enable row level security;

-- 정책 안에서 admin_users 를 그냥 조회하면 **그 조회에도 RLS 가 걸려 늘 0건**이
-- 나온다. 즉 관리자조차 통과하지 못한다. security definer 로 감싸 소유자 권한으로
-- 읽게 한다.
--
-- `set search_path` 는 생략하면 안 된다. security definer 함수는 호출자가 정한
-- search_path 를 그대로 쓰는데, 그 틈으로 같은 이름의 가짜 테이블을 앞세워
-- 함수를 속일 수 있다.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

grant execute on function is_admin() to authenticated;
-- anon 이 부를 일은 없다. 부르더라도 auth.uid() 가 null 이라 false 다.
revoke execute on function is_admin() from anon;

-- 조회 — 관리자 페이지의 목록·CSV 가 쓴다.
drop policy if exists rsvp_admin_select on rsvp;
create policy rsvp_admin_select on rsvp
  for select to authenticated
  using (is_admin());

-- 삭제 — AD-01 의 「삭제」. 잘못 들어온 회신이나 테스트 행을 지우는 용도다.
-- 수정(update)은 열지 않는다. 하객이 보낸 회신을 관리자가 고쳐 쓸 이유가 없고,
-- 열어 두면 실수로 원본이 바뀐 것을 알아챌 방법이 없다.
drop policy if exists rsvp_admin_delete on rsvp;
create policy rsvp_admin_delete on rsvp
  for delete to authenticated
  using (is_admin());
