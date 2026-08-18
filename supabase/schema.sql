-- SIS-33 — RSVP 수신용 Supabase 스키마. Supabase 대시보드의 SQL Editor 에 붙여 실행한다.
--
-- 이 파일이 스키마의 단일 기준이다. 대시보드에서 손으로 컬럼을 고치지 않는다 —
-- 고치면 이 파일과 실제 DB 가 어긋나고, 어긋난 것을 알아챌 방법이 없다.
--
-- **파일 전체를 복사해 한 번 Run 하면 된다.** 처음 만들 때도, 이미 만들어 둔 뒤에도
-- 같다. 여러 번 실행해도 안전하다.
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
-- 방명록(SIS-21)·관리자(SIS-22)는 같은 프로젝트에 테이블을 더 얹는다. 이 파일에는
-- RSVP 만 둔다.

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
  -- 컬럼 자체는 nullable 이지만 비워 둘 수 있다는 뜻이 아니다. **참석 회신에는
  -- 반드시 있어야 하고**, 그 강제는 아래 rsvp_phone_required_for_attendees 가
  -- 한다. not null 을 쓰지 않은 것은 미참석 회신에서는 연락처가 **선택**이기
  -- 때문이다 (SIS-35) — 못 간다고 알려주려는 하객을 연락처에서 막으면 회신 자체를
  -- 포기하고, 식수 파악이라는 본래 목적을 놓친다. 그래도 묻기는 하는 것은 축의
  -- 대조·답례·회신 정정에 그 번호 말고는 창구가 없기 때문이다.
  --
  -- 형식 제약도 이름을 붙여 아래에 따로 건다. 여기 인라인으로 적으면 새로 만든
  -- 경우에만 이름 없는 제약이 하나 더 생겨 둘이 겹친다.
  phone text,
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
alter table rsvp add constraint rsvp_phone_format check (phone is null or phone ~ '^[0-9-]{9,13}$');

-- 참석 회신에는 연락처가 반드시 있어야 한다. 화면(SIS-15)에서도 막지만 여기서
-- 한 번 더 닫는다 — 응답 마감일을 RLS 정책으로 닫은 것과 같은 이유다. 클라이언트
-- 검증만 믿으면 코드가 바뀌는 순간 조용히 빈 값이 쌓이고, 그때는 예식이 코앞이라
-- 다시 받을 방법이 없다.
alter table rsvp drop constraint if exists rsvp_phone_required_for_attendees;
alter table rsvp add constraint rsvp_phone_required_for_attendees check (attend = '미참석' or phone is not null);

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
