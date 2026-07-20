-- Hora aproximada en que se detectó cada ataque (primera captura que lo vio).
-- Sirve para saber si un robo de espejo cayó dentro de las últimas 5h (permitido
-- por las normas) o antes (infracción). Se preserva entre capturas. Ejecutar en
-- Supabase.
alter table war_attacks add column if not exists first_seen_at timestamptz;
