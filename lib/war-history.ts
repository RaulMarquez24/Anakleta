import { createServerClient } from "@/lib/supabase/server";

export interface WarSummary {
  id: number;
  isCwl: boolean;
  season: string | null;
  round: number | null;
  state: string | null;
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
  "id, is_cwl, season, round, state, opponent_name, clan_stars, opponent_stars, clan_destruction, opponent_destruction, result, start_time, end_time";

function toSummary(w: Record<string, unknown>): WarSummary {
  return {
    id: w.id as number,
    isCwl: Boolean(w.is_cwl),
    season: (w.season as string | null) ?? null,
    round: (w.round as number | null) ?? null,
    state: (w.state as string | null) ?? null,
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
