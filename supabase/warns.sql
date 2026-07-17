-- Warns (amonestaciones) de miembros. 1:muchos por tag. Un warn se "resuelve"
-- (active=false) dejando constancia de quién y qué pasó; no se borra (histórico).
-- La caducidad NO vive aquí: se calcula en lectura con settings.warns_expiry_days.
create table if not exists warns (
  id          bigint generated always as identity primary key,
  member_tag  text not null,
  reason      text not null,
  active      boolean not null default true,
  created_by  text,
  created_at  timestamptz default now(),
  resolved_by text,
  resolved_at timestamptz,
  resolution  text
);
create index if not exists warns_member_idx on warns (member_tag, created_at desc);
grant all privileges on table warns to service_role;
grant usage, select on sequence warns_id_seq to service_role;
