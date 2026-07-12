-- Quién lanzó cada ejecución de cron: "cron" (automático) o el email del colíder
-- que la disparó a mano desde el panel. La app es defensiva: funciona aunque no
-- exista aún (se registra sin actor). Ejecutar en Supabase.
alter table cron_runs add column if not exists actor text;
