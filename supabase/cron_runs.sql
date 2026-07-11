-- Registro de ejecuciones de los crons (para tener traza "por si acaso").
-- Ejecutar en Supabase → SQL Editor.
create table if not exists cron_runs (
  id         bigint generated always as identity primary key,
  job        text not null,             -- 'th-roles' | 'cwl-cron' | 'war-reminder'
  ok         boolean not null default true,
  summary    jsonb,                     -- resultado (a quién actualizó, avisos, etc.)
  created_at timestamptz not null default now()
);
create index if not exists cron_runs_job_time_idx on cron_runs (job, created_at desc);
create index if not exists cron_runs_time_idx on cron_runs (created_at desc);

grant all privileges on table cron_runs to service_role;
