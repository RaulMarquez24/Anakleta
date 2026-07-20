-- Esquema de la base de datos de Anakleta (Supabase / PostgreSQL).
-- Pegar y ejecutar en: Supabase → SQL Editor → New query → Run.
-- El proyecto tiene RLS automática: las tablas nuevas nacen bloqueadas (deny all).
-- Es lo deseado: el servidor accede con la SECRET KEY (bypasea RLS) y el cliente
-- solo hace login. No hace falta escribir políticas RLS finas para un panel privado.

-- Vínculo usuario (auth) ↔ jugador de CoC (verificado con verifytoken).
create table if not exists profiles (
  user_id     uuid primary key,
  player_tag  text,
  verified_at timestamptz,
  updated_at  timestamptz default now()
);

-- Mensajes cortos guardados (reclutamiento / anuncios para copiar al juego).
create table if not exists messages (
  id         bigint generated always as identity primary key,
  text       text not null,
  category   text not null default 'General',
  created_by text,
  created_at timestamptz default now()
);

-- Metadata del clan (normalmente una sola fila).
create table if not exists clans (
  tag           text primary key,
  name          text not null,
  level         int,
  updated_at    timestamptz default now()
);
-- Info extra del clan (de /clans/{tag}): para el Home del Clan.
alter table clans add column if not exists description       text;
alter table clans add column if not exists badge_url         text;
alter table clans add column if not exists war_league        text;
alter table clans add column if not exists clan_points       int;
alter table clans add column if not exists required_trophies int;
alter table clans add column if not exists war_wins          int;
alter table clans add column if not exists war_win_streak    int;

-- Miembros conocidos (estado "actual"). Upsert en cada snapshot.
-- CoC NO da fecha de entrada: se infiere por la primera vez que aparece el tag.
create table if not exists members (
  tag            text primary key,
  name           text not null,
  role           text,
  town_hall      int,
  first_seen_at  timestamptz default now(),
  last_seen_at   timestamptz default now(),
  is_active      boolean default true   -- false cuando desaparece de la lista (se fue / lo echaron)
);
-- Comentario manual opcional (p. ej. motivo de expulsión en ex-miembros), con
-- autor y fecha de quién lo escribió.
alter table members add column if not exists note    text;
alter table members add column if not exists note_by text;
alter table members add column if not exists note_at timestamptz;
-- Cuenta principal (para vincular cuentas secundarias/alts a la misma persona).
alter table members add column if not exists main_tag text;
-- Vínculo con Discord (para etiquetar en avisos).
alter table members add column if not exists discord_id       text;
alter table members add column if not exists discord_username text;
alter table members add column if not exists discord_by       text;
alter table members add column if not exists discord_at       timestamptz;
-- Control de retornados: un tag inactivo que vuelve se marca para revisión.
alter table members add column if not exists returned_at     timestamptz;
alter table members add column if not exists return_reviewed boolean default true;

-- Serie temporal: una fila por miembro y captura. El corazón de la app.
create table if not exists member_snapshots (
  id                  bigint generated always as identity primary key,
  member_tag          text references members(tag),
  captured_at         timestamptz not null default now(),
  donations           int,
  donations_received  int,
  trophies            int,
  builder_trophies    int,
  town_hall           int,
  role                text
);
create index if not exists member_snapshots_tag_time_idx
  on member_snapshots (member_tag, captured_at desc);
-- La actividad, las estadísticas y las tendencias del clan filtran por fecha
-- sobre todos los miembros: índice por captured_at.
create index if not exists member_snapshots_time_idx
  on member_snapshots (captured_at);

-- Guerras (normales y CWL).
create table if not exists wars (
  id             bigint generated always as identity primary key,
  war_tag        text unique,        -- null en guerra normal, presente en CWL
  state          text,               -- preparation / inWar / warEnded
  team_size      int,
  opponent_name  text,
  start_time     timestamptz,
  end_time       timestamptz,
  result         text,               -- win / lose / tie
  captured_at    timestamptz default now()
);

-- Ataques de nuestros miembros en cada guerra.
create table if not exists war_attacks (
  id             bigint generated always as identity primary key,
  war_id         bigint references wars(id),
  attacker_tag   text,
  defender_tag   text,
  stars          int,
  destruction    numeric,
  attack_order   int
);
-- Detalle del objetivo, duración y espejo de cada ataque.
alter table war_attacks add column if not exists duration          int;
alter table war_attacks add column if not exists defender_name     text;
alter table war_attacks add column if not exists defender_position int;
alter table war_attacks add column if not exists defender_th       int;
alter table war_attacks add column if not exists attacker_position int;
alter table war_attacks add column if not exists is_mirror         boolean;

-- Sistema de ligas nuevo (Ranked) + XP + datos por jugador (enriquecimiento).
-- El leagueTier es el "rango real": su id es creciente y sirve para ordenar.
-- (El sistema de ligas antiguo —league_id/league_name— se descartó: lo sustituye
-- leagueTier.)
alter table member_snapshots add column if not exists league_tier_id       int;
alter table member_snapshots add column if not exists league_tier_name     text;
alter table member_snapshots add column if not exists league_tier_icon     text;
alter table member_snapshots add column if not exists exp_level            int;
-- Enriquecimiento desde /players/{tag}:
alter table member_snapshots add column if not exists war_stars            int;
alter table member_snapshots add column if not exists attack_wins          int;
alter table member_snapshots add column if not exists defense_wins         int;
alter table member_snapshots add column if not exists war_preference       text;
alter table member_snapshots add column if not exists capital_contributions bigint;

-- Histórico de guerras: marca CWL, temporada, ronda, marcador y alineación.
alter table wars add column if not exists is_cwl               boolean default false;
alter table wars add column if not exists season               text;
alter table wars add column if not exists round                int;
alter table wars add column if not exists clan_stars           int;
alter table wars add column if not exists opponent_stars       int;
alter table wars add column if not exists clan_destruction     numeric;
alter table wars add column if not exists opponent_destruction numeric;
alter table wars add column if not exists finalized            boolean default false;

create table if not exists war_members (
  war_id        bigint references wars(id),
  tag           text,
  name          text,
  map_position  int,
  town_hall     int,
  attacks_used  int,
  stars         int,
  destruction   numeric
);
create index if not exists war_members_war_idx on war_members (war_id);

-- Control de recordatorios de guerra en Discord (para no repetir tramos de aviso).
create table if not exists war_reminders (
  war_key    text primary key,
  last_tier  int,
  updated_at timestamptz default now()
);

-- Ajustes clave-valor (p. ej. canal de Discord por defecto para avisos).
create table if not exists settings (
  key   text primary key,
  value text
);

-- Warns (amonestaciones) de miembros. Ver supabase/warns.sql. La caducidad se
-- calcula en lectura (settings.warns_expiry_days); aquí solo se persiste el warn.
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

-- Registro de ejecuciones de los crons (traza; ver supabase/cron_runs.sql).
create table if not exists cron_runs (
  id         bigint generated always as identity primary key,
  job        text not null,
  ok         boolean not null default true,
  summary    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cron_runs_time_idx on cron_runs (created_at desc);

-- Inscripciones a la CWL, atadas a cada temporada (ver supabase/cwl.sql para el
-- detalle y la config sembrada en settings). Las escriben el bot y la app.
create table if not exists cwl_lists (
  season         text primary key,
  state          text not null default 'open',
  size           int,
  opens_at       timestamptz,
  starts_at      timestamptz,
  ends_at        timestamptz,
  channel_id     text,
  message_id     text,
  announced_open boolean not null default false,
  announced_mid  boolean not null default false,
  announced_last boolean not null default false,
  roles_cleared  boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     text
);
create table if not exists cwl_signups (
  id          bigint generated always as identity primary key,
  season      text not null references cwl_lists(season) on delete cascade,
  discord_id  text,
  username    text,
  member_tag  text,
  source      text not null default 'discord',
  added_by    text,
  created_at  timestamptz not null default now()
);
create unique index if not exists cwl_signups_season_member_idx
  on cwl_signups (season, member_tag) where member_tag is not null;
create unique index if not exists cwl_signups_season_discord_idx
  on cwl_signups (season, discord_id) where discord_id is not null and member_tag is null;
create index if not exists cwl_signups_season_order_idx
  on cwl_signups (season, created_at);

-- Privilegios: con "expose new tables" desactivado, las tablas nuevas no reciben
-- GRANTs automáticos. Concedemos acceso SOLO a service_role (el rol del servidor,
-- usado por la SECRET KEY). NO se concede a anon/authenticated: los datos quedan
-- inaccesibles desde la publishable key del navegador, que solo sirve para login.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
-- Y para las tablas/secuencias que se creen en el futuro:
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
