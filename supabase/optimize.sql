-- Optimización de la BD de Anakleta.
-- Pegar y ejecutar en: Supabase → SQL Editor → New query → Run.
-- Solo elimina datos que NO se leen en ningún sitio + añade un índice útil.
-- NO toca builder_trophies (ahora se muestra en la ficha) ni war_attacks (ahora
-- alimenta el detalle ataque-a-ataque de la guerra).

-- 1) Columnas muertas de member_snapshots (nunca se leían):
--    - clan_rank  → redundante con el Ranking por leagueTier (y por copas que resetean)
--    - league_id / league_name → sistema de ligas antiguo, sustituido por leagueTier
alter table member_snapshots drop column if exists clan_rank;
alter table member_snapshots drop column if exists league_id;
alter table member_snapshots drop column if exists league_name;

-- 2) Índice por fecha: actividad, estadísticas y tendencias filtran por captured_at
--    sobre todos los miembros.
create index if not exists member_snapshots_time_idx
  on member_snapshots (captured_at);

-- 3) Info extra del clan (de /clans/{tag}) para el Home: descripción, liga de
--    guerra, escudo, puntos y racha. La llamada ya se hace; solo faltaba guardarlo.
alter table clans add column if not exists description       text;
alter table clans add column if not exists badge_url         text;
alter table clans add column if not exists war_league        text;
alter table clans add column if not exists clan_points       int;
alter table clans add column if not exists required_trophies int;
alter table clans add column if not exists war_wins          int;
alter table clans add column if not exists war_win_streak    int;
