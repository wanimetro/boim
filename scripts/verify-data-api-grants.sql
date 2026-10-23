-- Read-only: run after all migrations; every required privilege must be true.
with expected(table_name, role_name) as (
  values
    ('public.teams', 'service_role'),
    ('public.members', 'service_role'),
    ('public.tasks', 'service_role'),
    ('public.submissions', 'service_role'),
    ('public.views', 'service_role'),
    ('public.push_subscriptions', 'service_role'),
    ('public.notifications', 'service_role'),
    ('public.profiles', 'service_role'),
    ('public.task_edits', 'service_role')
)
select e.table_name, e.role_name, p.privilege,
  case when to_regclass(e.table_name) is null then false
    else has_table_privilege(e.role_name, to_regclass(e.table_name), p.privilege)
  end as granted
from expected e
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p(privilege)
where e.role_name = 'service_role' or p.privilege = 'SELECT'
order by e.table_name, e.role_name, p.privilege;

select r.role_name,
  has_schema_privilege(r.role_name, 'public', 'USAGE') as schema_usage
from (values ('service_role')) as r(role_name);

select n.nspname, c.relname, c.relrowsecurity as rls_enabled,
  pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname;

select case when to_regclass('public.team_code_seq') is null then false
  else has_sequence_privilege('service_role', to_regclass('public.team_code_seq'), 'USAGE')
end as team_code_sequence_usage;
