begin;
-- 결과물 확인 규칙.
--  자기 결과물에는 의견을 내지 않는다: 올린 사람·담당자는 확인 대상이 아니다.
--  결과물이 한 번이라도 올라오면 완료 기준은 누구도 바꿀 수 없다(피드백을 받고 기준을 낮춰 피하는 일을 막는다).
--  업무 수정은 팀장·등록한 사람만 한다.
-- 앱에서 기준을 따로 합의하던 시험 단계의 테이블·함수가 있으면 지운다(운영 DB에는 없다).
drop function if exists public.save_criteria_votes(uuid,uuid,integer,jsonb);
drop table if exists public.criteria_votes;

create or replace function public.save_submission_checks(p_submission_id uuid, p_member_id uuid, p_version integer, p_checks jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare s public.submissions; t public.tasks;
begin
  select * into s from public.submissions where id=p_submission_id;
  if not found then raise exception 'submission not found' using errcode='P0002'; end if;
  select * into t from public.tasks where id=s.task_id for update;
  if not exists(select 1 from public.members where id=p_member_id and team_id=t.team_id) then raise exception 'membership required' using errcode='42501'; end if;
  if s.uploader_id=p_member_id or t.owner_id=p_member_id then raise exception 'own work cannot check' using errcode='42501'; end if;
  if exists(select 1 from public.submissions where task_id=s.task_id and created_at>s.created_at) then raise exception 'not latest' using errcode='40001'; end if;
  if t.criteria_version<>p_version then raise exception 'criteria changed' using errcode='40001'; end if;
  delete from public.submission_checks where submission_id=p_submission_id and version=p_version and member_id=p_member_id;
  insert into public.submission_checks(submission_id,version,member_id,item,ok,reason)
  select p_submission_id,p_version,p_member_id,a.item,a.ok,a.reason from public.boim_item_answers(p_checks,cardinality(t.criteria)) a;
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
  if t.criteria is distinct from items and exists(select 1 from public.submissions where task_id=p_task_id) then
    raise exception 'criteria locked' using errcode='42501'; end if;
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

revoke all on function public.save_submission_checks(uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.update_task_with_edit(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_submission_checks(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.update_task_with_edit(uuid,uuid,jsonb) to service_role;

commit;
