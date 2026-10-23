-- 계정(Supabase Auth)과 팀 스스로 만들기 · 초대 코드.
-- 운영자는 팀을 만들지 않고 흐름만 본다. 측정은 여전히 팀 코드(T1)·팀원 번호(U01)로 한다.

-- 닉네임: 팀 화면에 보이는 이름. 실명을 강요하지 않는다.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- 팀원 = 계정 + 팀. 번호(U01)는 팀 안에서 자동으로 붙는다.
alter table members add column user_id uuid references auth.users(id) on delete cascade;
alter table members add constraint members_team_user_key unique (team_id, user_id);

-- 팀: 만든 사람, 초대 코드, 판정에 넣을지(운영자가 끔)
create sequence team_code_seq;
alter table teams alter column code set default 'T' || nextval('team_code_seq');
alter table teams add column created_by uuid references auth.users(id) on delete set null;
alter table teams add column invite_code text unique;
alter table teams add column in_study boolean not null default true;

-- 알림 기기는 사람(계정)에 붙인다. 한 사람이 여러 팀에 있어도 기기는 하나로 받는다.
delete from push_subscriptions;
alter table push_subscriptions drop column member_id;
alter table push_subscriptions add column user_id uuid not null references auth.users(id) on delete cascade;
create index on push_subscriptions (user_id);

-- Data API access is explicit; browser roles remain blocked by RLS.
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.profiles
to service_role;
grant usage on sequence public.team_code_seq to service_role;
