-- Eventos del clan: un evento activo a la vez (el del momento). Solo sirve para
-- dejar CONSTANCIA de quién participó y darle un pequeño plus de cara a los
-- ascensos. Nunca penaliza a quien no participa.
--
-- La participación entra de dos formas:
--   · automática, desde la mecánica del evento en Discord (p. ej. el
--     intercambio de cartas marca a quien cierra un trato), o
--   · manual, si un colíder la añade (eventos sin interacción en Discord).
-- Ejecutar en Supabase.
create table if not exists clan_events (
  id          bigint generated always as identity primary key,
  name        text not null,
  starts_at   timestamptz,
  ends_at     timestamptz,
  -- Fuente automática de participación, si la tiene: 'cards' (u otra futura).
  auto_source text,
  active      boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists clan_events_active_idx on clan_events (active, created_at desc);

create table if not exists clan_event_participants (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references clan_events(id) on delete cascade,
  member_tag text,                            -- jugador (si se conoce)
  discord_id text,                            -- por si vino de Discord sin vincular
  source     text not null default 'manual',  -- 'manual' | 'cards' | …
  added_by   text,                            -- quién lo marcó (si fue manual)
  created_at timestamptz not null default now()
);
-- Una participación por jugador y evento (marcarlo dos veces no duplica).
create unique index if not exists clan_event_participants_tag_uidx
  on clan_event_participants (event_id, member_tag) where member_tag is not null;
create unique index if not exists clan_event_participants_discord_uidx
  on clan_event_participants (event_id, discord_id) where discord_id is not null and member_tag is null;

grant all privileges on table clan_events to service_role;
grant all privileges on table clan_event_participants to service_role;
grant usage, select on sequence clan_events_id_seq to service_role;
grant usage, select on sequence clan_event_participants_id_seq to service_role;
