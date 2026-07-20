-- Más detalle por ataque de guerra: a quién atacó (defensor), cuánto duró y si
-- respetó el espejo (misma posición que la suya). Ejecutar en Supabase.
alter table war_attacks add column if not exists duration          int;      -- segundos
alter table war_attacks add column if not exists defender_name     text;
alter table war_attacks add column if not exists defender_position int;
alter table war_attacks add column if not exists defender_th       int;
alter table war_attacks add column if not exists attacker_position int;
alter table war_attacks add column if not exists is_mirror         boolean;  -- posición atacante == defensor
