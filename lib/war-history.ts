import { createServerClient } from "@/lib/supabase/server";

export interface WarSummary {
  id: number;
  isCwl: boolean;
  season: string | null;
  round: number | null;
  state: string | null;
  teamSize: number | null;
  opponentName: string | null;
  clanStars: number | null;
  opponentStars: number | null;
  clanDestruction: number | null;
  opponentDestruction: number | null;
  result: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface CwlSeasonSummary {
  season: string;
  wars: number;
  wins: number;
  losses: number;
  ties: number;
  from: string | null; // primera guerra de la temporada
}

export interface WarMemberDetail {
  tag: string;
  name: string;
  mapPosition: number;
  townHall: number;
  attacksUsed: number;
  stars: number;
  destruction: number;
}

const WAR_COLS =
  "id, is_cwl, season, round, state, team_size, opponent_name, clan_stars, opponent_stars, clan_destruction, opponent_destruction, result, start_time, end_time";

function toSummary(w: Record<string, unknown>): WarSummary {
  return {
    id: w.id as number,
    isCwl: Boolean(w.is_cwl),
    season: (w.season as string | null) ?? null,
    round: (w.round as number | null) ?? null,
    state: (w.state as string | null) ?? null,
    teamSize: (w.team_size as number | null) ?? null,
    opponentName: (w.opponent_name as string | null) ?? null,
    clanStars: (w.clan_stars as number | null) ?? null,
    opponentStars: (w.opponent_stars as number | null) ?? null,
    clanDestruction: (w.clan_destruction as number | null) ?? null,
    opponentDestruction: (w.opponent_destruction as number | null) ?? null,
    result: (w.result as string | null) ?? null,
    startTime: (w.start_time as string | null) ?? null,
    endTime: (w.end_time as string | null) ?? null,
  };
}

// Guerras normales (no CWL), de la más reciente a la más antigua.
export async function getNormalWars(): Promise<WarSummary[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("wars")
    .select(WAR_COLS)
    .eq("is_cwl", false)
    .order("start_time", { ascending: false });
  return (data ?? []).map((w) => toSummary(w as Record<string, unknown>));
}

// Temporadas de CWL con su resumen (victorias/derrotas), más recientes primero.
export async function getCwlSeasons(): Promise<CwlSeasonSummary[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("wars")
    .select("season, result, start_time")
    .eq("is_cwl", true)
    .not("season", "is", null);

  const map = new Map<string, CwlSeasonSummary>();
  for (const w of data ?? []) {
    const season = w.season as string;
    if (!map.has(season)) {
      map.set(season, { season, wars: 0, wins: 0, losses: 0, ties: 0, from: null });
    }
    const s = map.get(season)!;
    s.wars++;
    if (w.result === "win") s.wins++;
    else if (w.result === "lose") s.losses++;
    else if (w.result === "tie") s.ties++;
    const st = w.start_time as string | null;
    if (st && (!s.from || st < s.from)) s.from = st;
  }
  return [...map.values()].sort((a, b) => b.season.localeCompare(a.season));
}

// Guerras (rondas) de una temporada de CWL, ordenadas por ronda.
export async function getSeasonWars(season: string): Promise<WarSummary[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("wars")
    .select(WAR_COLS)
    .eq("is_cwl", true)
    .eq("season", season)
    .order("round", { ascending: true });
  return (data ?? []).map((w) => toSummary(w as Record<string, unknown>));
}

export interface SeasonMemberStat {
  tag: string;
  name: string;
  roundsPlayed: number; // rondas en las que estuvo alineado
  attacksUsed: number;
  missed: number; // rondas alineado sin atacar
  stars: number;
}
export interface SeasonSummary {
  totalRounds: number; // rondas con datos
  expectedRounds: number; // 7 en CWL estándar
  wins: number;
  losses: number;
  ties: number;
  clanStars: number;
  members: SeasonMemberStat[]; // ordenado por estrellas desc
}

const CWL_ROUNDS = 7;

// Resumen agregado de una temporada de CWL: récord + rendimiento por miembro.
export async function getSeasonSummary(season: string): Promise<SeasonSummary> {
  const supabase = createServerClient();
  const { data: wars } = await supabase
    .from("wars")
    .select("id, round, result, clan_stars")
    .eq("is_cwl", true)
    .eq("season", season);

  const rows = wars ?? [];
  const ids = rows.map((w) => w.id as number);
  let wins = 0,
    losses = 0,
    ties = 0,
    clanStars = 0;
  let maxRound = 0;
  for (const w of rows) {
    if (w.result === "win") wins++;
    else if (w.result === "lose") losses++;
    else if (w.result === "tie") ties++;
    clanStars += (w.clan_stars as number | null) ?? 0;
    maxRound = Math.max(maxRound, (w.round as number | null) ?? 0);
  }

  const agg = new Map<string, SeasonMemberStat>();
  if (ids.length > 0) {
    const { data: wm } = await supabase
      .from("war_members")
      .select("tag, name, attacks_used, stars")
      .in("war_id", ids)
      .limit(50000);
    for (const m of wm ?? []) {
      const tag = m.tag as string;
      if (!agg.has(tag)) {
        agg.set(tag, { tag, name: m.name as string, roundsPlayed: 0, attacksUsed: 0, missed: 0, stars: 0 });
      }
      const s = agg.get(tag)!;
      s.name = (m.name as string) ?? s.name;
      s.roundsPlayed++;
      const used = (m.attacks_used as number | null) ?? 0;
      s.attacksUsed += used;
      if (used === 0) s.missed++;
      s.stars += (m.stars as number | null) ?? 0;
    }
  }

  const members = [...agg.values()].sort(
    (a, b) => b.stars - a.stars || b.attacksUsed - a.attacksUsed || a.missed - b.missed,
  );

  return {
    totalRounds: rows.length,
    expectedRounds: Math.max(CWL_ROUNDS, maxRound),
    wins,
    losses,
    ties,
    clanStars,
    members,
  };
}

export interface WarAlert {
  pendingCount: number;
  endsAt: string | null;
  label: string; // "CWL · Ronda 6" o "la guerra"
}

// Aviso global de ataques pendientes: lee de BD la guerra en curso (state=inWar)
// y cuántos alineados no han atacado. Barato (sin API); refleja la última captura.
export async function getWarAlert(): Promise<WarAlert | null> {
  const supabase = createServerClient();
  const { data: war } = await supabase
    .from("wars")
    .select("id, is_cwl, round, end_time")
    .eq("state", "inWar")
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!war) return null;

  const { count } = await supabase
    .from("war_members")
    .select("tag", { count: "exact", head: true })
    .eq("war_id", war.id as number)
    .eq("attacks_used", 0);

  const pendingCount = count ?? 0;
  if (pendingCount === 0) return null;

  // Solo avisar si quedan menos de 12h (y la guerra no ha terminado aún).
  const endsAt = (war.end_time as string | null) ?? null;
  if (!endsAt) return null;
  const msLeft = new Date(endsAt).getTime() - Date.now();
  if (msLeft <= 0 || msLeft > 12 * 3_600_000) return null;

  return {
    pendingCount,
    endsAt,
    label: war.is_cwl ? `CWL · Ronda ${war.round ?? "?"}` : "la guerra",
  };
}

// Detalle de una guerra: cabecera + alineación de nuestro clan.
export async function getWarDetail(
  id: number,
): Promise<{ war: WarSummary; members: WarMemberDetail[] } | null> {
  const supabase = createServerClient();
  const { data: war } = await supabase.from("wars").select(WAR_COLS).eq("id", id).maybeSingle();
  if (!war) return null;

  const { data: members } = await supabase
    .from("war_members")
    .select("tag, name, map_position, town_hall, attacks_used, stars, destruction")
    .eq("war_id", id)
    .order("map_position", { ascending: true });

  return {
    war: toSummary(war as Record<string, unknown>),
    members: (members ?? []).map((m) => ({
      tag: m.tag as string,
      name: m.name as string,
      mapPosition: (m.map_position as number | null) ?? 0,
      townHall: (m.town_hall as number | null) ?? 0,
      attacksUsed: (m.attacks_used as number | null) ?? 0,
      stars: (m.stars as number | null) ?? 0,
      destruction: (m.destruction as number | null) ?? 0,
    })),
  };
}
