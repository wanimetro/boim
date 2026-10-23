begin;
-- Service-only atomic persistence. Existing tables, grants and RLS stay intact.
create or replace function public.create_team_with_leader(p_user_id uuid, p_name text, p_token text, p_invite_code text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t public.teams;
begin
  if p_user_id is null then raise exception 'user required' using errcode='42501'; end if;
  if char_length(trim(p_name)) not between 1 and 40 then raise exception 'invalid team name' using errcode='22023'; end if;
  insert into public.teams(name, token, invite_code, created_by) values(trim(p_name), p_token, p_invite_code, p_user_id) returning * into t;
  insert into public.members(team_id, user_id, code, is_leader) values(t.id, p_user_id, 'U01', true);
  return to_jsonb(t);
end $$;

create or replace function public.join_team_atomic(p_team_id uuid, p_user_id uuid, p_invite_code text)
returns void language plpgsql security invoker set search_path = '' as $$
declare t public.teams; next_code integer;
begin
  if p_user_id is null then raise exception 'user required' using errcode='42501'; end if;
  select * into t from public.teams where id=p_team_id for update;
  if not found then raise exception 'team not found' using errcode='P0002'; end if;
  if exists(select 1 from public.members where team_id=p_team_id and user_id=p_user_id) then return; end if;
  if t.invite_code is null or t.invite_code is distinct from p_invite_code then raise exception 'invite expired' using errcode='42501'; end if;
  select coalesce(max(nullif(regexp_replace(code,'[^0-9]','','g'),'')::integer),0)+1 into next_code from public.members where team_id=p_team_id;
  insert into public.members(team_id,user_id,code) values(p_team_id,p_user_id,'U'||lpad(next_code::text,greatest(2,char_length(next_code::text)),'0'));
end $$;

create or replace function public.create_task_atomic(p_team_id uuid, p_member_id uuid, p_input jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare next_seq integer; deadline timestamp;
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found then raise exception 'team not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.members where id=p_member_id and team_id=p_team_id) then raise exception 'membership required' using errcode='42501'; end if;
  if not exists(select 1 from public.members where id=(p_input->>'owner_id')::uuid and team_id=p_team_id) then raise exception 'invalid owner' using errcode='22023'; end if;
  deadline=(p_input->>'due')::date+(p_input->>'due_time')::time;
  if deadline is null or deadline <= timezone('Asia/Seoul',clock_timestamp()) then raise exception 'deadline elapsed' using errcode='22023'; end if;
  if char_length(trim(p_input->>'title')) not between 1 and 80 or char_length(trim(p_input->>'rule')) not between 5 and 200 then raise exception 'invalid task' using errcode='22023'; end if;
  select coalesce(max(seq),0)+1 into next_seq from public.tasks where team_id=p_team_id;
  insert into public.tasks(team_id,seq,title,owner_id,due,due_time,rule,created_by)
  values(p_team_id,next_seq,p_input->>'title',(p_input->>'owner_id')::uuid,(p_input->>'due')::date,(p_input->>'due_time')::time,p_input->>'rule',p_member_id);
end $$;

create or replace function public.update_task_with_edit(p_task_id uuid, p_member_id uuid, p_input jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare t public.tasks; m public.members; old_values jsonb; new_values jsonb; before_changes jsonb; after_changes jsonb;
begin
  select * into t from public.tasks where id=p_task_id for update;
  if not found then raise exception 'task not found' using errcode='P0002'; end if;
  select * into m from public.members where id=p_member_id and team_id=t.team_id;
  if not found or not coalesce(m.is_leader or t.created_by=m.id,false) then raise exception 'edit forbidden' using errcode='42501'; end if;
  if t.due+t.due_time <= timezone('Asia/Seoul',clock_timestamp()) then raise exception 'deadline elapsed' using errcode='22023'; end if;
  if not exists(select 1 from public.members where id=(p_input->>'owner_id')::uuid and team_id=t.team_id) then raise exception 'invalid owner' using errcode='22023'; end if;
  if (p_input->>'due')::date+(p_input->>'due_time')::time <= timezone('Asia/Seoul',clock_timestamp()) then raise exception 'invalid deadline' using errcode='22023'; end if;
  if char_length(trim(p_input->>'title')) not between 1 and 80 or char_length(trim(p_input->>'rule')) not between 5 and 200 then raise exception 'invalid task' using errcode='22023'; end if;
  old_values=jsonb_build_object('title',t.title,'owner_id',t.owner_id::text,'due',t.due::text,'due_time',to_char(t.due_time,'HH24:MI'),'rule',t.rule);
  new_values=jsonb_build_object('title',p_input->>'title','owner_id',p_input->>'owner_id','due',p_input->>'due','due_time',p_input->>'due_time','rule',p_input->>'rule');
  select jsonb_object_agg(o.key,o.value),jsonb_object_agg(o.key,new_values->o.key) into before_changes,after_changes from jsonb_each(old_values) o where o.value is distinct from new_values->o.key;
  if before_changes is null then return false; end if;
  update public.tasks set title=p_input->>'title',owner_id=(p_input->>'owner_id')::uuid,due=(p_input->>'due')::date,due_time=(p_input->>'due_time')::time,rule=p_input->>'rule' where id=p_task_id;
  insert into public.task_edits(task_id,member_id,before,after) values(p_task_id,p_member_id,before_changes,after_changes);
  return true;
end $$;

revoke all on function public.create_team_with_leader(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.join_team_atomic(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.create_task_atomic(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_task_with_edit(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_team_with_leader(uuid,text,text,text) to service_role;
grant execute on function public.join_team_atomic(uuid,uuid,text) to service_role;
grant execute on function public.create_task_atomic(uuid,uuid,jsonb) to service_role;
grant execute on function public.update_task_with_edit(uuid,uuid,jsonb) to service_role;

commit;
