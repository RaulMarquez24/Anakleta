-- Marca una guerra como "ya reconciliada con el warlog" (marcador final oficial).
-- Una vez finalized=true no se vuelve a tocar (no tiene sentido recargar guerras
-- de hace meses). Ejecutar en Supabase.
alter table wars add column if not exists finalized boolean default false;
