-- ============================================================================
-- SEED de desarrollo: inscripción de la CWL que acaba de terminar.
-- Sirve para probar la vista con datos reales.
-- Requiere haber ejecutado antes supabase/cwl.sql.
--
-- CLAVE: engancha la inscripción a la MISMA temporada (season) con la que ya
-- están guardadas las guerras de esa liga (la última CWL en `wars`), para que
-- en el hub salga UNA sola liga (inscripción + participación juntas), no dos.
-- Idempotente: no re-inserta inscritos si esa temporada ya tiene.
-- ============================================================================

-- 0) Corrige el índice único de discord (versión antigua era demasiado estricta:
--    impedía inscribir varias cuentas de una misma persona con el mismo Discord).
drop index if exists cwl_signups_season_discord_idx;
create unique index if not exists cwl_signups_season_discord_idx
  on cwl_signups (season, discord_id) where discord_id is not null and member_tag is null;

do $$
declare
  tgt   text;
  base  timestamptz;
begin
  -- Temporada de la última CWL con datos de guerra.
  select season into tgt
  from wars
  where is_cwl = true and season is not null
  order by season desc
  limit 1;

  if tgt is null then
    raise notice 'No hay datos de CWL en wars: nada que sembrar.';
    return;
  end if;

  -- Limpia una inscripción "suelta" sembrada antes con otra season (p. ej. 2026-07
  -- si las guerras estaban bajo otra clave). Solo toca filas de seed.
  delete from cwl_lists where created_by = 'seed' and season <> tgt;

  -- 1) La liga (inscripción unida a la liga). Ya terminada -> 'closed'. Fechas
  --    derivadas de las guerras de esa temporada.
  insert into cwl_lists
    (season, state, size, opens_at, starts_at, ends_at, created_by,
     announced_open, announced_mid, announced_last, roles_cleared)
  select
    tgt, 'closed', null,
    (select min(start_time) from wars where season = tgt) - interval '7 days',
    (select min(start_time) from wars where season = tgt),
    (select max(end_time)   from wars where season = tgt),
    'seed', true, true, true, true
  on conflict (season) do nothing;

  -- 2) Inscritos, si esa temporada no tiene ya. Orden por created_at (la semana
  --    previa al inicio). Vincula a members por nombre (TH + ocultar ex-miembros).
  base := coalesce((select min(start_time) from wars where season = tgt), now()) - interval '7 days';

  if not exists (select 1 from cwl_signups where season = tgt) then
    insert into cwl_signups (season, username, member_tag, discord_id, source, added_by, created_at)
    select
      tgt,
      v.name,
      (select m.tag        from members m where lower(m.name) = lower(v.name) limit 1),
      (select m.discord_id from members m where lower(m.name) = lower(v.name) limit 1),
      'app', 'seed',
      base + (v.ord * interval '1 minute')
    from (values
      (1,  'Raul2402'),
      (2,  'VITI22'),
      (3,  'Jesus'),
      (4,  'Mirai'),
      (5,  'JairoAlexandro'),
      (6,  'Miriam'),
      (7,  'ItzGaming'),
      (8,  'Rodrox XD'),
      (9,  'JOSUEE'),
      (10, 'Lybraris'),
      (11, 'Boxiercap'),
      (12, 'SrDan'),
      (13, 'itz Edher'),
      (14, 'Max of clans'),
      (15, 'THE KILLER'),
      (16, 'Christian VB'),
      (17, '...B...'),
      (18, 'DrachelnHaps'),
      (19, 'Felizjr 17'),
      (20, 'Facutex765'),
      (21, 'Brayan'),
      -- Secundarias (nombre real de la cuenta entre paréntesis en el mensaje original):
      (22, 'VITI23'),
      (23, 'Hechizus'),
      (24, 'JOSUEE DOS'),
      (25, 'JOSUEE TRES'),
      (26, 'JOSUEE CUATRO'),
      (27, 'Brayan 2'),
      (28, 'Yahir.c'),
      (29, 'Yahir')
    ) as v(ord, name);
  end if;

  raise notice 'Inscripción sembrada en la temporada %', tgt;
end $$;
