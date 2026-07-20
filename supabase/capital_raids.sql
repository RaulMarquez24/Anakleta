-- Asaltos de Capital (Clan Capital Raids), un registro por fin de semana.
-- Sirve para ver quién participa cada finde (norma del clan). Ejecutar en Supabase.
create table if not exists capital_raids (
  id          bigint generated always as identity primary key,
  start_time  timestamptz unique,   -- clave del fin de semana
  end_time    timestamptz,
  state       text,                 -- ongoing / ended
  total_loot  int,
  captured_at timestamptz default now()
);

-- Participación de cada miembro en ese asalto (solo aparecen los que atacaron;
-- quien no está en la lista no participó).
create table if not exists capital_raid_members (
  id           bigint generated always as identity primary key,
  raid_id      bigint references capital_raids(id) on delete cascade,
  tag          text,
  name         text,
  attacks      int,   -- ataques usados
  attack_limit int,   -- ataques base (normalmente 5)
  bonus_limit  int,   -- ataques bonus (normalmente 1)
  looted       int    -- recursos saqueados
);
create index if not exists capital_raid_members_raid_idx on capital_raid_members (raid_id);
create index if not exists capital_raid_members_tag_idx on capital_raid_members (tag);

grant all privileges on table capital_raids to service_role;
grant all privileges on table capital_raid_members to service_role;
grant usage, select on sequence capital_raids_id_seq to service_role;
grant usage, select on sequence capital_raid_members_id_seq to service_role;
