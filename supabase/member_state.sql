-- Estado DERIVADO de cada miembro, mantenido en cada captura. Evita releer miles
-- de snapshots para calcular rachas (y evita el tope de filas de la API, que
-- truncaba el histórico y hacía que todos salieran con la misma racha).
-- Ejecutar en Supabase. Al final está el backfill con los datos ya guardados.

-- Rachas / marcas de tiempo
alter table members add column if not exists red_since        timestamptz; -- en rojo desde (null = verde)
alter table members add column if not exists last_activity_at timestamptz; -- última señal real de juego
alter table members add column if not exists last_donation_at timestamptz; -- última vez que donó
alter table members add column if not exists ranked_last_at   timestamptz; -- última vez con copas ranked

-- Ranked por semanas (contadores acumulados)
alter table members add column if not exists ranked_weeks     int default 0;   -- semanas en las que compitió
alter table members add column if not exists tracked_weeks    int default 0;   -- semanas observadas
alter table members add column if not exists week_key         int;             -- semana en curso (días desde epoch, lunes)
alter table members add column if not exists ranked_this_week boolean default false;

-- Últimos valores vistos: comparando con ellos se detecta la "subida" (=jugó)
-- sin tener que leer la captura anterior.
alter table members add column if not exists prev_donations   int;
alter table members add column if not exists prev_received    int;
alter table members add column if not exists prev_attack_wins int;
alter table members add column if not exists prev_war_stars   int;
alter table members add column if not exists prev_capital     bigint;
alter table members add column if not exists prev_exp_level   int;
alter table members add column if not exists prev_war_pref    text;

-- ───────────────────────────────────────────────────────────────────────────
-- BACKFILL: rellena el estado con el histórico que ya está en member_snapshots.
-- Es idempotente: se puede volver a ejecutar.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) Últimos valores vistos (de la captura más reciente de cada miembro).
with ult as (
  select distinct on (member_tag)
    member_tag, captured_at, donations, donations_received, attack_wins,
    war_stars, capital_contributions, exp_level, war_preference, trophies
  from member_snapshots
  order by member_tag, captured_at desc
)
update members m set
  prev_donations   = u.donations,
  prev_received    = u.donations_received,
  prev_attack_wins = u.attack_wins,
  prev_war_stars   = u.war_stars,
  prev_capital     = u.capital_contributions,
  prev_exp_level   = u.exp_level,
  prev_war_pref    = u.war_preference
from ult u where m.tag = u.member_tag;

-- 2) Última actividad real: última captura en la que SUBIÓ alguna señal.
with dif as (
  select member_tag, captured_at,
    donations             - lag(donations)             over w as d_don,
    donations_received    - lag(donations_received)    over w as d_rec,
    attack_wins           - lag(attack_wins)           over w as d_atk,
    war_stars             - lag(war_stars)             over w as d_war,
    capital_contributions - lag(capital_contributions) over w as d_cap,
    exp_level             - lag(exp_level)             over w as d_exp
  from member_snapshots
  window w as (partition by member_tag order by captured_at)
), act as (
  select member_tag, max(captured_at) as at
  from dif
  where coalesce(d_don,0) > 0 or coalesce(d_rec,0) > 0 or coalesce(d_atk,0) > 0
     or coalesce(d_war,0) > 0 or coalesce(d_cap,0) > 0 or coalesce(d_exp,0) > 0
  group by member_tag
)
update members m set last_activity_at = a.at
from act a where m.tag = a.member_tag;

-- 3) Última donación (última captura en la que subió el contador de donaciones).
with dif as (
  select member_tag, captured_at,
    donations - lag(donations) over (partition by member_tag order by captured_at) as d_don
  from member_snapshots
), don as (
  select member_tag, max(captured_at) as at from dif where coalesce(d_don,0) > 0 group by member_tag
)
update members m set last_donation_at = d.at
from don d where m.tag = d.member_tag;

-- 4) Última vez con copas ranked (> 0).
with rk as (
  select member_tag, max(captured_at) as at
  from member_snapshots where coalesce(trophies,0) > 0 group by member_tag
)
update members m set ranked_last_at = rk.at
from rk where m.tag = rk.member_tag;

-- 5) "En rojo desde": inicio de la racha actual de war_preference = 'out'.
--    (Si la última captura no está en 'out', queda null = está en verde.)
with marcado as (
  select member_tag, captured_at, war_preference,
         case when war_preference is distinct from
                   lag(war_preference) over (partition by member_tag order by captured_at)
              then 1 else 0 end as cambio
  from member_snapshots
), grupos as (
  select member_tag, captured_at, war_preference,
         sum(cambio) over (partition by member_tag order by captured_at) as grupo
  from marcado
), ultimo as (
  select distinct on (member_tag) member_tag, war_preference, grupo
  from grupos order by member_tag, captured_at desc
), inicio as (
  select g.member_tag, min(g.captured_at) as at
  from grupos g join ultimo u on u.member_tag = g.member_tag and u.grupo = g.grupo
  where u.war_preference = 'out'
  group by g.member_tag
)
update members m set red_since = i.at
from inicio i where m.tag = i.member_tag;
update members set red_since = null
where tag in (
  select distinct on (member_tag) member_tag from member_snapshots
  order by member_tag, captured_at desc
) and prev_war_pref is distinct from 'out';

-- 6) Semanas de ranked: cuántas semanas (lunes) tuvo copas y cuántas se observaron.
with sem as (
  select member_tag,
         floor(extract(epoch from date_trunc('week', captured_at)) / 86400)::int as wk,
         max(coalesce(trophies,0)) as top
  from member_snapshots
  group by 1, 2
), agg as (
  select member_tag,
         count(*)::int as semanas,
         count(*) filter (where top > 0)::int as jugadas,
         max(wk) as ultima
  from sem group by member_tag
)
update members m set
  tracked_weeks    = a.semanas,
  ranked_weeks     = a.jugadas,
  week_key         = a.ultima,
  ranked_this_week = exists (
    select 1 from sem s where s.member_tag = m.tag and s.wk = a.ultima and s.top > 0
  )
from agg a where m.tag = a.member_tag;
