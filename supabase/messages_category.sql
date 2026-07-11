-- Categoría para los mensajes guardados (reclutamiento, anuncios, eventos…).
-- Ejecutar en Supabase. La app es defensiva: funciona aunque no exista aún,
-- pero sin esta columna todos los mensajes se tratan como "General".
alter table messages add column if not exists category text not null default 'General';
