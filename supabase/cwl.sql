-- ============================================================================
-- CWL: inscripciones por temporada (Liga de Clanes).
-- Pegar y ejecutar en: Supabase → SQL Editor → New query → Run.
-- Reemplaza la antigua cwl_signups plana por un sistema atado a la temporada.
-- Idempotente salvo el DROP inicial de la tabla plana (solo tenía datos de prueba).
-- ============================================================================

-- 1) Una lista por temporada de CWL (YYYY-MM, o con sufijo -2 para eventos).
create table if not exists cwl_lists (
  season         text primary key,               -- "2026-08" (season del leaguegroup de CoC)
  state          text not null default 'open',   -- 'open' | 'closed' (solo inscripción individual)
  size           int,                            -- null = corte dinámico 15→30; o fijo 15/30
  opens_at       timestamptz,
  starts_at      timestamptz,                    -- inicio de la liga = fin de inscripción individual
  ends_at        timestamptz,
  channel_id     text,                           -- canal del mensaje fijo en tiempo real
  message_id     text,                           -- id del mensaje fijo (se edita en cada cambio)
  announced_open boolean not null default false, -- dedupe de avisos del cron
  announced_mid  boolean not null default false,
  announced_last boolean not null default false,
  roles_cleared  boolean not null default false, -- rol CWL ya retirado al terminar
  created_at     timestamptz not null default now(),
  created_by     text
);

-- 2) Inscripciones (orden de inscripción = created_at). Reescrita.
drop table if exists cwl_signups;
create table cwl_signups (
  id          bigint generated always as identity primary key,
  season      text not null references cwl_lists(season) on delete cascade,
  discord_id  text,                 -- para inscripción por Discord y asignación de rol
  username    text,
  member_tag  text,                 -- vínculo opcional a members(tag) (altas desde la app)
  source      text not null default 'discord', -- 'discord' | 'app'
  added_by    text,                 -- 'self' o email del colíder que lo apuntó
  created_at  timestamptz not null default now()
);

-- Cada cuenta (member_tag) solo una vez por temporada.
create unique index if not exists cwl_signups_season_member_idx
  on cwl_signups (season, member_tag) where member_tag is not null;
-- Un mismo Discord no puede AUTO-apuntarse dos veces (self-signup sin cuenta
-- asociada). NO se restringe cuando hay member_tag: una persona puede inscribir
-- varias cuentas (principal + secundarias) con el mismo Discord.
create unique index if not exists cwl_signups_season_discord_idx
  on cwl_signups (season, discord_id) where discord_id is not null and member_tag is null;
create index if not exists cwl_signups_season_order_idx
  on cwl_signups (season, created_at);

-- 3) Config editable desde la app (settings clave-valor ya existe en schema.sql).
--    on conflict do nothing: no pisa lo que el usuario cambie más adelante.
insert into settings (key, value) values
  ('cwl_list_channel_id', '1367753138249142384'),
  ('cwl_role_id',         '1525166010489896970'),
  ('clan_role_id',        '1410598355641434294')
on conflict (key) do nothing;

-- Privilegios: cubiertos por el "alter default privileges ... to service_role"
-- de schema.sql. Por si se ejecuta este fichero aislado, reforzamos:
grant all privileges on table cwl_lists   to service_role;
grant all privileges on table cwl_signups to service_role;
grant all privileges on all sequences in schema public to service_role;
