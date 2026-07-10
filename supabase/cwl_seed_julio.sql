-- ============================================================================
-- SEED de desarrollo: inscripción de la CWL de Julio 2026 (2026-07),
-- la liga que acaba de terminar. Sirve para probar la vista con datos reales.
-- Requiere haber ejecutado antes supabase/cwl.sql.
-- Idempotente: no vuelve a insertar si la temporada ya tiene inscritos.
-- (Cuando lleguen los detalles de guerra de esa liga, la Participación se
--  completa sola; esto solo carga la INSCRIPCIÓN.)
-- ============================================================================

-- 0) Corrige el índice único de discord (versión antigua era demasiado estricta:
--    impedía inscribir varias cuentas de una misma persona con el mismo Discord).
drop index if exists cwl_signups_season_discord_idx;
create unique index if not exists cwl_signups_season_discord_idx
  on cwl_signups (season, discord_id) where discord_id is not null and member_tag is null;

-- 1) La liga (inscripción va unida a la liga). Ya terminada -> 'closed'.
insert into cwl_lists
  (season, state, size, opens_at, starts_at, ends_at, created_by,
   announced_open, announced_mid, announced_last, roles_cleared)
values
  ('2026-07', 'closed', null,
   '2026-06-25T08:00:00Z', '2026-07-02T08:00:00Z', '2026-07-09T08:00:00Z', 'seed',
   true, true, true, true)
on conflict (season) do nothing;

-- 2) Inscritos (orden preservado por created_at). Vincula a members por nombre
--    (si existe) para mostrar TH y aplicar el ocultado de ex-miembros; discord
--    también se toma del miembro si lo tiene vinculado.
insert into cwl_signups (season, username, member_tag, discord_id, source, added_by, created_at)
select
  '2026-07',
  v.name,
  (select m.tag        from members m where lower(m.name) = lower(v.name) limit 1),
  (select m.discord_id from members m where lower(m.name) = lower(v.name) limit 1),
  'app', 'seed',
  timestamptz '2026-06-25T10:00:00Z' + (v.ord * interval '1 minute')
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
) as v(ord, name)
where not exists (select 1 from cwl_signups where season = '2026-07');
