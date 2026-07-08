-- Esquema de la base de datos de Anakleta (Supabase / PostgreSQL).
-- Pegar y ejecutar en: Supabase → SQL Editor → New query → Run.
-- El proyecto tiene RLS automática: las tablas nuevas nacen bloqueadas (deny all).
-- Es lo deseado: el servidor accede con la SECRET KEY (bypasea RLS) y el cliente
-- solo hace login. No hace falta escribir políticas RLS finas para un panel privado.

-- Metadata del clan (normalmente una sola fila).
create table if not exists clans (
  tag           text primary key,
  name          text not null,
  level         int,
  updated_at    timestamptz default now()
);

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

-- Serie temporal: una fila por miembro y captura. El corazón de la app.
create table if not exists member_snapshots (
  id                  bigint generated always as identity primary key,
  member_tag          text references members(tag),
  captured_at         timestamptz not null default now(),
  donations           int,
  donations_received  int,
  trophies            int,
  builder_trophies    int,
  clan_rank           int,
  town_hall           int,
  role                text
);
create index if not exists member_snapshots_tag_time_idx
  on member_snapshots (member_tag, captured_at desc);

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

-- Sistema de ligas nuevo (Ranked) + XP + datos por jugador (enriquecimiento).
-- El leagueTier es el "rango real": su id es creciente y sirve para ordenar.
alter table member_snapshots add column if not exists league_id            int;
alter table member_snapshots add column if not exists league_name          text;
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
