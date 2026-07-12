-- Correcciones manuales del "2º ataque (ayuda)" por guerra. war_key = hora de
-- inicio de la guerra (estable mientras dura). should = true (sí puede ayudar) /
-- false (no hace falta), sobreescribe el filtro automático por TH.
create table if not exists war_help_overrides (
  war_key    text not null,
  tag        text not null,
  should     boolean not null,
  updated_by text,
  updated_at timestamptz default now(),
  primary key (war_key, tag)
);
grant all privileges on table war_help_overrides to service_role;
