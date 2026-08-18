-- SIS-33 — RSVP 수신용 Supabase 스키마. Supabase 대시보드의 SQL Editor 에 붙여 실행한다.
--
-- 이 파일이 스키마의 단일 기준이다. 대시보드에서 손으로 컬럼을 고치지 않는다 —
-- 고치면 이 파일과 실제 DB 가 어긋나고, 어긋난 것을 알아챌 방법이 없다.
-- 여러 번 실행해도 안전하도록 썼다(if not exists / drop policy if exists).
--
-- 방명록(SIS-21)·관리자(SIS-22)는 같은 프로젝트에 테이블을 더 얹는다. 이 파일에는
-- RSVP 만 둔다.

create table if not exists rsvp (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('신랑측', '신부측')),
  attend text not null check (attend in ('참석', '미참석')),
  name text not null check (char_length(name) between 1 and 20),
  count int not null check (count between 1 and 20),
  -- 식사 여부 3택 (고객 확정 2026-08-18 — B안). 화면 문구는 SIS-15 가 정하지만
  -- 저장값은 이 세 가지여야 한다. 문구를 바꾸려면 이 제약을 함께 고친다.
  meal text not null check (meal in ('식사', '식사안함', '미정')),
  created_at timestamptz not null default now()
);

-- 「전하고 싶은 말」 컬럼은 두지 않는다. 방명록(SIS-21)이 같은 역할을 하므로
-- 받지 않기로 고객이 확정했다(2026-08-18).
--
-- 연락처 컬럼도 아직 없다. 수집하기로 방향은 정해졌으나 항목(대표 1개 / 참석자별,
-- 필수 여부)이 확정되지 않았고, 수집 항목이 개인정보 동의 문구(RS-03)와 맞물린다.
-- 확정되면 SIS-15 에서 alter table 로 추가하고 이 파일에 반영한다.

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
