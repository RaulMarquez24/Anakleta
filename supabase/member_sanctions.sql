-- Sanciones aplicadas a un miembro para COMPENSAR una propuesta de expulsión,
-- venga de warns, inactividad, guerras sin atacar, días en rojo, etc.
-- Mientras la sanción está vigente, la app no vuelve a proponer su expulsión
-- (baja a "revisar") y deja constancia de qué se hizo y por qué.
-- Ejecutar en Supabase.
create table if not exists member_sanctions (
  id              bigint generated always as identity primary key,
  member_tag      text not null,
  sanction        text not null,        -- qué medida se aplicó
  applied_to_tag  text,                 -- si se aplicó sobre otra cuenta suya
  applied_to_name text,
  reasons         text,                 -- motivos que había en ese momento
  note            text,
  created_by      text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,          -- hasta cuándo compensa (null = indefinida)
  revoked         boolean not null default false
);
create index if not exists member_sanctions_tag_idx on member_sanctions (member_tag, created_at desc);
-- Alcance del perdón: 'all' (todo), 'warns' (solo los warns) u 'others' (todo
-- menos los warns: guerras, inactividad, rojo, donaciones…).
alter table member_sanctions add column if not exists scope text not null default 'all';

grant all privileges on table member_sanctions to service_role;
grant usage, select on sequence member_sanctions_id_seq to service_role;
