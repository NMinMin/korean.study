-- READ-ONLY schema inventory for Supabase/PostgreSQL.
-- Run the whole file in Supabase SQL Editor, then export the result as CSV.
-- This query does not create, alter, update, or delete anything.

with schema_objects as (
  select
    '01_table'::text as object_type,
    n.nspname::text as schema_name,
    c.relname::text as object_name,
    jsonb_pretty(jsonb_build_object(
      'kind', case c.relkind when 'p' then 'partitioned table' else 'table' end,
      'owner', pg_get_userbyid(c.relowner),
      'row_level_security', c.relrowsecurity,
      'force_row_level_security', c.relforcerowsecurity
    )) as definition
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')

  union all

  select
    '02_column',
    col.table_schema,
    col.table_name || '.' || col.column_name,
    jsonb_pretty(jsonb_build_object(
      'position', col.ordinal_position,
      'data_type', col.data_type,
      'udt_name', col.udt_name,
      'nullable', col.is_nullable,
      'default', col.column_default,
      'identity', col.is_identity,
      'identity_generation', col.identity_generation,
      'generated', col.is_generated,
      'generation_expression', col.generation_expression
    ))
  from information_schema.columns col
  where col.table_schema = 'public'

  union all

  select
    '03_constraint',
    n.nspname,
    c.relname || '.' || con.conname,
    jsonb_pretty(jsonb_build_object(
      'type', case con.contype
        when 'p' then 'primary_key'
        when 'f' then 'foreign_key'
        when 'u' then 'unique'
        when 'c' then 'check'
        when 'x' then 'exclusion'
        else con.contype::text
      end,
      'definition', pg_get_constraintdef(con.oid, true),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'initially_deferred', con.condeferred
    ))
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'

  union all

  select
    '04_index',
    n.nspname,
    t.relname || '.' || i.relname,
    pg_get_indexdef(i.oid)
  from pg_index ix
  join pg_class i on i.oid = ix.indexrelid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'

  union all

  select
    '05_trigger',
    n.nspname,
    c.relname || '.' || t.tgname,
    pg_get_triggerdef(t.oid, true)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal

  union all

  select
    case p.prokind when 'p' then '07_procedure' else '06_function' end,
    n.nspname,
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')

  union all

  select
    '08_policy',
    pol.schemaname,
    pol.tablename || '.' || pol.policyname,
    jsonb_pretty(jsonb_build_object(
      'permissive', pol.permissive,
      'roles', pol.roles,
      'command', pol.cmd,
      'using', pol.qual,
      'with_check', pol.with_check
    ))
  from pg_policies pol
  where pol.schemaname = 'public'

  union all

  select
    case c.relkind when 'm' then '10_materialized_view' else '09_view' end,
    n.nspname,
    c.relname,
    pg_get_viewdef(c.oid, true)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')

  union all

  select
    '11_enum',
    n.nspname,
    t.typname,
    jsonb_pretty(jsonb_build_object(
      'values', jsonb_agg(e.enumlabel order by e.enumsortorder)
    ))
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
  group by n.nspname, t.typname

  union all

  select
    '12_sequence',
    n.nspname,
    c.relname,
    jsonb_pretty(jsonb_build_object('owner', pg_get_userbyid(c.relowner)))
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S'

  union all

  select
    '13_table_grant',
    g.table_schema,
    g.table_name || '.' || g.grantee,
    jsonb_pretty(jsonb_build_object(
      'grantee', g.grantee,
      'privileges', jsonb_agg(distinct g.privilege_type order by g.privilege_type)
    ))
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
  group by g.table_schema, g.table_name, g.grantee

  union all

  select
    '14_realtime_publication',
    pt.schemaname,
    pt.tablename || '.' || pt.pubname,
    jsonb_pretty(jsonb_build_object('publication', pt.pubname))
  from pg_publication_tables pt
  where pt.schemaname = 'public'
)
select object_type, schema_name, object_name, definition
from schema_objects
order by object_type, schema_name, object_name;
