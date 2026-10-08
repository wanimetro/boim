-- 보임 MVP 스키마
-- 모든 테이블은 RLS를 켜고 정책을 두지 않는다. 브라우저는 DB에 직접 접근하지 않고,
-- 서버(Next.js)가 service role 키로만 읽고 쓴다. 팀 접근 권한은 팀 링크의 token으로 판단한다.

create extension if not exists pgcrypto;

create table teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- T1, T2 ...
  name text not null,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  code text not null,                        -- U01, U02 ... 실명은 저장하지 않는다
  is_leader boolean not null default false,
  unique (team_id, code)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  seq int not null,                          -- 업무 코드 = 팀 코드 + '-' + seq
  title text not null,
  owner_id uuid not null references members(id),
  due date not null,
  rule text not null,                        -- 완료 기준
  created_by uuid references members(id),
  created_at timestamptz not null default now(),
  unique (team_id, seq)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  uploader_id uuid references members(id),  -- 올린 사람 (본인 첨부율의 근거)
  file_path text,                            -- storage 'submissions' 버킷 경로
  file_name text,
  link_url text,
  note text,
  review text not null default 'pending' check (review in ('pending', 'pass', 'fail')),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (file_path is not null or link_url is not null)
);

create table views (
  id bigint generated always as identity primary key,
  team_id uuid not null references teams(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on tasks (team_id);
create index on submissions (task_id, created_at desc);
create index on views (team_id, created_at);

alter table teams enable row level security;
alter table members enable row level security;
alter table tasks enable row level security;
alter table submissions enable row level security;
alter table views enable row level security;

-- 제출 파일 버킷 (비공개). 업로드는 서버가 발급한 서명 URL로만 한다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', false, 20971520)
on conflict (id) do nothing;
