-- Intercambio de cartas del evento (Clashiversario): cada jugador publica las
-- cartas que le SOBRAN (repetidas) y el bot mantiene un tablón en Discord
-- agrupado por carta, para saber a quién pedírsela. Ejecutar en Supabase.
create table if not exists card_offers (
  id         bigint generated always as identity primary key,
  discord_id text not null,
  username   text,
  card       text not null,          -- nombre exacto de la carta
  created_at timestamptz not null default now()
);
-- Una carta por persona (marcarla dos veces no duplica).
create unique index if not exists card_offers_user_card_uidx on card_offers (discord_id, card);
create index if not exists card_offers_card_idx on card_offers (card);

grant all privileges on table card_offers to service_role;
grant usage, select on sequence card_offers_id_seq to service_role;

-- Ajustes (se editan desde el panel de Discord de la app):
--   cards_enabled    '1' para activar el sistema (mientras no lo esté, el
--                    comando /repetidas ni siquiera aparece en Discord)
--   cards_channel_id canal donde vive el tablón
--   cards_message_id id del mensaje del tablón (lo gestiona el bot)
insert into settings (key, value) values ('cards_enabled', '0')
  on conflict (key) do nothing;
