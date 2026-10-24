begin;
-- 완료 기준을 항목으로 나누고, 팀원이 이름 없이 "항목"에 의견을 낸다.
-- 1단계(기준 합의): 등록한 사람을 뺀 팀원이 항목마다 동의/수정 필요(이유 필수).
-- 2단계(결과물 확인): 올린 사람을 뺀 팀원이 항목마다 충족/미충족(이유 필수).
-- 전원 동의 또는 12시간 동안 반대 의견이 없으면 확정한다. 확정 여부는 저장된 응답과 시각으로
-- 서버가 계산하므로(domain/criteria.ts) 예약 작업이 필요 없다. 기존 데이터는 지우지 않는다.

-- 기준 항목. 기존 한 줄 기준은 항목 1개가 된다. rule은 항목을 이어 붙인 표시용 사본으로 남긴다.
alter table public.tasks add column criteria text[];
update public.tasks set criteria = array[rule];
alter table public.tasks alter column criteria set not null;
-- 기준을 고칠 때마다 1씩 올라가고, 그때부터 다시 합의한다. 예전 차수의 응답은 기록으로만 남는다.
alter table public.tasks add column criteria_version integer not null default 1;
alter table public.tasks add column criteria_proposed_at timestamptz not null default now();
update public.tasks set criteria_proposed_at = created_at;

create table public.criteria_votes (
  task_id uuid not null references public.tasks(id) on delete cascade,
  version integer not null,
  member_id uuid not null references public.members(id) on delete cascade,
  item integer not null check (item >= 0),
  ok boolean not null,
  reason text check (reason is null or char_length(reason) between 2 and 100),
  created_at timestamptz not null default now(),
  primary key (task_id, version, member_id, item),
  check (ok or reason is not null)
);

create table public.submission_checks (
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version integer not null,
  member_id uuid not null references public.members(id) on delete cascade,
  item integer not null check (item >= 0),
  ok boolean not null,
  reason text check (reason is null or char_length(reason) between 2 and 100),
  created_at timestamptz not null default now(),
  primary key (submission_id, version, member_id, item),
  check (ok or reason is not null)
);

alter table public.criteria_votes enable row level security;
alter table public.submission_checks enable row level security;
grant select, insert, update, delete on table public.criteria_votes, public.submission_checks to service_role;

-- 기준 항목 검사: 1~8개, 항목마다 2~100자
create or replace function public.boim_criteria(p jsonb)
returns text[] language plpgsql immutable security invoker set search_path = '' as $$
declare items text[];
begin
  if p is null or jsonb_typeof(p) <> 'array' then raise exception 'invalid criteria' using errcode='22023'; end if;
  select coalesce(array_agg(trim(v) order by o), '{}') into items from jsonb_array_elements_text(p) with ordinality as e(v, o);
  if cardinality(items) not between 1 and 8 then raise exception 'invalid criteria' using errcode='22023'; end if;
  if exists(select 1 from unnest(items) i where char_length(i) not between 2 and 100) then raise exception 'invalid criteria' using errcode='22023'; end if;
  return items;
end $$;

-- 항목별 응답 검사: 모든 항목에 하나씩, 반대면 이유 2~100자
create or replace function public.boim_item_answers(p jsonb, n integer)
returns table(item integer, ok boolean, reason text) language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) <> n then raise exception 'invalid answers' using errcode='22023'; end if;
  if (select count(distinct (e->>'item')::integer) from jsonb_array_elements(p) e where (e->>'item')::integer between 0 and n-1) <> n then
    raise exception 'invalid answers' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p) e where jsonb_typeof(e->'ok') <> 'boolean'
            or (not (e->>'ok')::boolean and char_length(trim(coalesce(e->>'reason',''))) not between 2 and 100)) then
    raise exception 'invalid answers' using errcode='22023'; end if;
  return query select (e->>'item')::integer, (e->>'ok')::boolean,
    case when (e->>'ok')::boolean then null else trim(e->>'reason') end from jsonb_array_elements(p) e;
end $$;

create or replace function public.create_task_atomic(p_team_id uuid, p_member_id uuid, p_input jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare next_seq integer; deadline timestamp; items text[];
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found then raise exception 'team not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.members where id=p_member_id and team_id=p_team_id) then raise exception 'membership required' using errcode='42501'; end if;
  if not exists(select 1 from public.members where id=(p_input->>'owner_id')::uuid and team_id=p_team_id) then raise exception 'invalid owner' using errcode='22023'; end if;
  deadline=(p_input->>'due')::date+(p_input->>'due_time')::time;
  if deadline is null or deadline <= timezone('Asia/Seoul',clock_timestamp()) then raise exception 'deadline elapsed' using errcode='22023'; end if;
  if char_length(trim(p_input->>'title')) not between 1 and 80 then raise exception 'invalid task' using errcode='22023'; end if;
  items=public.boim_criteria(p_input->'criteria');
  select coalesce(max(seq),0)+1 into next_seq from public.tasks where team_id=p_team_id;
  insert into public.tasks(team_id,seq,title,owner_id,due,due_time,rule,criteria,created_by)
  values(p_team_id,next_seq,p_input->>'title',(p_input->>'owner_id')::uuid,(p_input->>'due')::date,(p_input->>'due_time')::time,
         array_to_string(items,' / '),items,p_member_id);
end $$;

create or replace function public.update_task_with_edit(p_task_id uuid, p_member_id uuid, p_input jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare t public.tasks; m public.members; items text[]; old_values jsonb; new_values jsonb; before_changes jsonb; after_changes jsonb;
begin
  select * into t from public.tasks where id=p_task_id for update;
  if not found then raise exception 'task not found' using errcode='P0002'; end if;
  select * into m from public.members where id=p_member_id and team_id=t.team_id;
  if not found or not coalesce(m.is_leader or t.created_by=m.id,false) then raise exception 'edit forbidden' using errcode='42501'; end if;
  if t.due+t.due_time <= timezone('Asia/Seoul',clock_timestamp()) then raise exception 'deadline elapsed' using errcode='22023'; end if;
  if not exists(select 1 from public.members where id=(p_input->>'owner_id')::uuid and team_id=t.team_id) then raise exception 'invalid owner' using errcode='22023'; end if;
  if (p_input->>'due')::date+(p_input->>'due_time')::time <= timezone('Asia/Seoul',clock_timestamp()) then raise exception 'invalid deadline' using errcode='22023'; end if;
  if char_length(trim(p_input->>'title')) not between 1 and 80 then raise exception 'invalid task' using errcode='22023'; end if;
  items=public.boim_criteria(p_input->'criteria');
  old_values=jsonb_build_object('title',t.title,'owner_id',t.owner_id::text,'due',t.due::text,'due_time',to_char(t.due_time,'HH24:MI'),'criteria',to_jsonb(t.criteria));
  new_values=jsonb_build_object('title',p_input->>'title','owner_id',p_input->>'owner_id','due',p_input->>'due','due_time',p_input->>'due_time','criteria',to_jsonb(items));
  select jsonb_object_agg(o.key,o.value),jsonb_object_agg(o.key,new_values->o.key) into before_changes,after_changes from jsonb_each(old_values) o where o.value is distinct from new_values->o.key;
  if before_changes is null then return false; end if;
  update public.tasks set title=p_input->>'title',owner_id=(p_input->>'owner_id')::uuid,due=(p_input->>'due')::date,due_time=(p_input->>'due_time')::time,
    rule=array_to_string(items,' / '),criteria=items,
    criteria_version=case when t.criteria is distinct from items then t.criteria_version+1 else t.criteria_version end,
    criteria_proposed_at=case when t.criteria is distinct from items then clock_timestamp() else t.criteria_proposed_at end
  where id=p_task_id;
  insert into public.task_edits(task_id,member_id,before,after) values(p_task_id,p_member_id,before_changes,after_changes);
  return true;
end $$;

-- 한 사람의 기준 응답을 통째로 바꾼다. 차수가 바뀌었으면(그사이 기준 수정) 거절한다.
create or replace function public.save_criteria_votes(p_task_id uuid, p_member_id uuid, p_version integer, p_votes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id=p_task_id for update;
  if not found then raise exception 'task not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.members where id=p_member_id and team_id=t.team_id) then raise exception 'membership required' using errcode='42501'; end if;
  if t.created_by=p_member_id then raise exception 'creator cannot vote' using errcode='42501'; end if;
  if t.criteria_version<>p_version then raise exception 'criteria changed' using errcode='40001'; end if;
  delete from public.criteria_votes where task_id=p_task_id and version=p_version and member_id=p_member_id;
  insert into public.criteria_votes(task_id,version,member_id,item,ok,reason)
  select p_task_id,p_version,p_member_id,a.item,a.ok,a.reason from public.boim_item_answers(p_votes,cardinality(t.criteria)) a;
end $$;

-- 한 사람의 결과물 확인을 통째로 바꾼다. 가장 최근에 올린 결과물만, 올린 사람이 아닌 팀원만.
create or replace function public.save_submission_checks(p_submission_id uuid, p_member_id uuid, p_version integer, p_checks jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare s public.submissions; t public.tasks;
begin
  select * into s from public.submissions where id=p_submission_id;
  if not found then raise exception 'submission not found' using errcode='P0002'; end if;
  select * into t from public.tasks where id=s.task_id for update;
  if not exists(select 1 from public.members where id=p_member_id and team_id=t.team_id) then raise exception 'membership required' using errcode='42501'; end if;
  if s.uploader_id=p_member_id then raise exception 'uploader cannot check' using errcode='42501'; end if;
  if exists(select 1 from public.submissions where task_id=s.task_id and created_at>s.created_at) then raise exception 'not latest' using errcode='40001'; end if;
  if t.criteria_version<>p_version then raise exception 'criteria changed' using errcode='40001'; end if;
  delete from public.submission_checks where submission_id=p_submission_id and version=p_version and member_id=p_member_id;
  insert into public.submission_checks(submission_id,version,member_id,item,ok,reason)
  select p_submission_id,p_version,p_member_id,a.item,a.ok,a.reason from public.boim_item_answers(p_checks,cardinality(t.criteria)) a;
end $$;

revoke all on function public.boim_criteria(jsonb) from public,anon,authenticated;
revoke all on function public.boim_item_answers(jsonb,integer) from public,anon,authenticated;
revoke all on function public.create_task_atomic(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_task_with_edit(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.save_criteria_votes(uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.save_submission_checks(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.boim_criteria(jsonb) to service_role;
grant execute on function public.boim_item_answers(jsonb,integer) to service_role;
grant execute on function public.create_task_atomic(uuid,uuid,jsonb) to service_role;
grant execute on function public.update_task_with_edit(uuid,uuid,jsonb) to service_role;
grant execute on function public.save_criteria_votes(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.save_submission_checks(uuid,uuid,integer,jsonb) to service_role;

commit;
