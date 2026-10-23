-- Backfill privileges on databases where 0001-0005 already ran.
-- RLS and existing grants are unchanged; no browser table access is added.
begin;

grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.teams,
  public.members,
  public.tasks,
  public.submissions,
  public.views,
  public.push_subscriptions,
  public.notifications,
  public.profiles,
  public.task_edits
to service_role;
grant usage on sequence public.team_code_seq to service_role;

commit;
