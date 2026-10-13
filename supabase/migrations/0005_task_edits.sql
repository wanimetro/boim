-- 업무 수정 기록. 마감 전까지 팀장이나 등록한 사람이 고칠 수 있고,
-- 판정을 해석할 때 기준·마감이 바뀌었는지 볼 수 있게 바꾸기 전과 후를 남긴다.
create table task_edits (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  before jsonb not null,
  after jsonb not null,
  created_at timestamptz not null default now()
);
create index on task_edits (task_id, created_at desc);
alter table task_edits enable row level security;
