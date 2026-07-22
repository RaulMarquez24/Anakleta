-- Congela la clasificación de espejo de cada ataque EN EL MOMENTO de capturarlo
-- (mirror/cleanup/late/stolen/offmirror). Así un robo detectado con >5h restantes
-- se guarda como "stolen" y un cron posterior (ya dentro de las 5h) no lo degrada.
-- Ejecutar en Supabase.
alter table war_attacks add column if not exists mirror_status text;
