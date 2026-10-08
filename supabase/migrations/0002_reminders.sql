-- 마감 하루 전 알림(DM)을 보낸 시각. 판정은 이 시각 전에 담당 본인이 올린 항목만 센다.
alter table tasks add column reminded_at timestamptz;
