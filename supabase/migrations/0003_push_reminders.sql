-- 앱 알림(웹 푸시): 마감 1시간 전·30분 전에 담당자에게 보낸다.
-- 운영자가 보내던 하루 전 DM은 없앤다. 판정은 "마감 24시간 전까지 본인이 올렸는가"로 센다.

alter table tasks drop column if exists reminded_at;
alter table tasks add column due_time time not null default '23:59';

-- 기기마다 하나. 한 사람이 폰·노트북 둘 다 켤 수 있다.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- 발송 기록. kind: '60' = 1시간 전, '30' = 30분 전.
-- status: sent 성공 / failed 실패 / no_device 담당자가 알림을 켜지 않음
create table notifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('60', '30')),
  endpoint text not null default '',            -- no_device면 ''
  status text not null check (status in ('sent', 'failed', 'no_device')),
  error text,
  sent_at timestamptz not null default now(),
  unique (task_id, kind, endpoint)                -- 같은 알림을 두 번 보내지 않는다
);

create index on push_subscriptions (member_id);
create index on notifications (sent_at);

alter table push_subscriptions enable row level security;
alter table notifications enable row level security;

-- 5분마다 앱의 알림 엔드포인트를 부른다. 주소와 비밀 값은 Vault에 넣는다(저장소에 올리지 않음):
--   select vault.create_secret('https://<도메인>/api/cron/remind', 'boim_cron_url');
--   select vault.create_secret('<CRON_SECRET>', 'boim_cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'boim-remind',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'boim_cron_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'boim_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'boim_cron_url');
  $$
);
