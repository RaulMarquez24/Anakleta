-- Vincula la LISTA de inscripciones (cuya `season` la calcula el cron por
-- calendario) con la TEMPORADA REAL que reporta la API de Clash (la que llevan
-- las guerras). Antes se dependía de que ambas cadenas coincidieran; si no,
-- la liga empezada y sus inscripciones quedaban desconectadas.
-- Ejecutar en Supabase.
alter table cwl_lists add column if not exists coc_season text;
create index if not exists cwl_lists_coc_season_idx on cwl_lists (coc_season);

-- Enlace de lo que ya hay: a la lista más reciente sin vincular se le asigna la
-- temporada de CWL más reciente registrada en `wars`.
update cwl_lists l
set coc_season = (
  select w.season from wars w
  where w.is_cwl = true and w.season is not null
  order by w.start_time desc limit 1
)
where l.coc_season is null
  and l.season = (select max(season) from cwl_lists)
  and exists (select 1 from wars w where w.is_cwl = true and w.season is not null);
