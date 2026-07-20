import { createServerClient } from "@/lib/supabase/server";
import { getCurrentWar, classifyAttackStatus, type MirrorStatus } from "@/lib/war";
import { getRulesConfig, stealWindowMs } from "@/lib/rules";

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

export interface WarAttackDetail {
  stars: number;
  destruction: number;
  order: number;
  duration: number | null;
  defenderName: string | null;
  defenderPosition: number | null;
  defenderTh: number | null;
  isMirror: boolean | null;
  mirrorStatus: MirrorStatus | null;
  stolenFrom: string | null;
}
export interface WarMemberDetail {
  tag: string;
  name: string;
  mapPosition: number;
  townHall: number;
  attacksUsed: number;
  stars: number;
  destruction: number;
  attacks: WarAttackDetail[]; // cada ataque individual (de war_attacks), en orden
}

const WAR_COLS =
  "id, is_cwl, season, round, state, team_size, opponent_name, clan_stars, opponent_stars, clan_destruction, opponent_destruction, result, start_time, end_time";

function toSummary(w: Record<string, unknown>): WarSummary {
  const rawState = (w.state as string | null) ?? null;
  const endTime = (w.end_time as string | null) ?? null;
  const clanStars = (w.clan_stars as number | null) ?? null;
  const opponentStars = (w.opponent_stars as number | null) ?? null;
  const clanDestruction = (w.clan_destruction as number | null) ?? null;
  const opponentDestruction = (w.opponent_destruction as number | null) ?? null;
  let result = (w.result as string | null) ?? null;
  let state = rawState;

  // Autocuración: una guerra cuya hora de fin ya pasó está TERMINADA aunque la
  // última captura se quedara en "inWar" (acabó entre capturas y no se re-grabó).
  // Así no sale "En guerra" ni "faltan por atacar" días después.
  const ended = rawState === "warEnded" || (endTime != null && new Date(endTime).getTime() < Date.now());
  if (ended) {
    state = "warEnded";
    if (!result) {
      const a = clanStars ?? 0;
      const b = opponentStars ?? 0;
      const ca = clanDestruction ?? 0;
      const cb = opponentDestruction ?? 0;
      result = a > b ? "win" : a < b ? "lose" : ca > cb ? "win" : ca < cb ? "lose" : "tie";
    }
  }

  return {
    id: w.id as number,
    isCwl: Boolean(w.is_cwl),
    season: (w.season as string | null) ?? null,
    round: (w.round as number | null) ?? null,
    state,
    teamSize: (w.team_size as number | null) ?? null,
    opponentName: (w.opponent_name as string | null) ?? null,
    clanStars,
    opponentStars,
    clanDestruction,
    opponentDestruction,
    result,
    startTime: (w.start_time as string | null) ?? null,
    endTime,
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

// Cuadro completo de una temporada de CWL: estrellas por ronda + totales, para
// el resumen que se publica en Discord.
export interface SeasonRoundCell {
  stars: number;
  attacked: boolean; // true si usó su ataque esa ronda (aunque fueran 0 estrellas)
}
export interface SeasonScoreRow {
  tag: string;
  name: string;
  // Solo hay clave para las rondas en las que estuvo ALINEADO. Sin clave = no
  // jugaba ese día; clave con attacked=false = alineado pero no atacó (falta).
  byRound: Record<number, SeasonRoundCell>;
  totalStars: number;
  totalDestruction: number;
  attacksTotal: number; // ataques usados en toda la temporada
}
export interface SeasonScoreboard {
  season: string;
  rounds: number[]; // [1..maxRound]
  rows: SeasonScoreRow[]; // ordenado por estrellas desc, luego % desc
}

export async function getSeasonScoreboard(season: string): Promise<SeasonScoreboard> {
  const supabase = createServerClient();
  const { data: wars } = await supabase
    .from("wars")
    .select("id, round")
    .eq("is_cwl", true)
    .eq("season", season);

  const roundByWar = new Map<number, number>();
  let maxRound = 0;
  for (const w of wars ?? []) {
    const r = (w.round as number | null) ?? 0;
    roundByWar.set(w.id as number, r);
    if (r > maxRound) maxRound = r;
  }
  const warIds = [...roundByWar.keys()];
  if (warIds.length === 0) return { season, rounds: [], rows: [] };

  const { data: wm } = await supabase
    .from("war_members")
    .select("war_id, tag, name, stars, destruction, attacks_used")
    .in("war_id", warIds)
    .limit(50000);

  const byTag = new Map<string, SeasonScoreRow>();
  for (const m of wm ?? []) {
    const round = roundByWar.get(m.war_id as number) ?? 0;
    const tag = m.tag as string;
    if (!byTag.has(tag))
      byTag.set(tag, {
        tag,
        name: m.name as string,
        byRound: {},
        totalStars: 0,
        totalDestruction: 0,
        attacksTotal: 0,
      });
    const row = byTag.get(tag)!;
    if (m.name) row.name = m.name as string;
    const stars = (m.stars as number | null) ?? 0;
    const used = (m.attacks_used as number | null) ?? 0;
    row.byRound[round] = { stars, attacked: used > 0 };
    row.totalStars += stars;
    row.totalDestruction += Number(m.destruction ?? 0);
    row.attacksTotal += used;
  }

  const rows = [...byTag.values()].sort(
    (a, b) => b.totalStars - a.totalStars || b.totalDestruction - a.totalDestruction,
  );
  return { season, rounds: Array.from({ length: maxRound }, (_, i) => i + 1), rows };
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

// Aviso global de ataques pendientes. A diferencia del histórico, esto es dato
// SENSIBLE AL TIEMPO ("¿quién queda por atacar AHORA?"), así que NO lee de la
// captura de 6h: deriva de la guerra en vivo (getCurrentWar, cacheada 120s). No
// cacheamos aquí a propósito: el dato caro (API) ya está cacheado dentro, y así
// el corte de "<12h" y el "quedan Xh" se recalculan frescos en cada entrada.
export async function getWarAlert(): Promise<WarAlert | null> {
  const war = await getCurrentWar().catch(() => null);
  if (!war || war.state !== "inWar") return null;

  // Solo el ataque OBLIGATORIO (no hizo ninguno). El 2º es ayuda, no se avisa.
  const pendingCount = war.members.filter((m) => m.attacksUsed === 0).length;
  if (pendingCount === 0) return null;

  // Solo avisar si quedan menos de 12h (y la guerra no ha terminado aún).
  const endsAt = war.endTime;
  if (!endsAt) return null;
  const msLeft = new Date(endsAt).getTime() - Date.now();
  if (msLeft <= 0 || msLeft > 12 * 3_600_000) return null;

  return {
    pendingCount,
    endsAt,
    label: war.isCwl ? `CWL · Ronda ${war.round ?? "?"}` : "la guerra",
  };
}

export interface MemberWarEntry {
  warId: number;
  isCwl: boolean;
  season: string | null;
  round: number | null;
  opponentName: string | null;
  startTime: string | null;
  attacksUsed: number;
  stars: number;
}
export interface MemberSeasonStat {
  season: string;
  rounds: number;
  attacks: number;
  missed: number;
  stars: number;
}

// Historial de guerra de un miembro: cada guerra en la que estuvo alineado + un
// resumen por temporada de CWL.
export async function getMemberWarLog(
  tag: string,
): Promise<{ wars: MemberWarEntry[]; seasons: MemberSeasonStat[] }> {
  const supabase = createServerClient();
  const { data: wm } = await supabase
    .from("war_members")
    .select("war_id, attacks_used, stars")
    .eq("tag", tag)
    .limit(5000);
  if (!wm || wm.length === 0) return { wars: [], seasons: [] };

  const ids = [...new Set(wm.map((m) => m.war_id as number))];
  const { data: warRows } = await supabase
    .from("wars")
    .select("id, is_cwl, season, round, opponent_name, start_time, state")
    .in("id", ids);
  const warById = new Map((warRows ?? []).map((w) => [w.id as number, w]));

  const wars: MemberWarEntry[] = wm
    .map((m) => {
      const w = warById.get(m.war_id as number);
      return {
        warId: m.war_id as number,
        isCwl: Boolean(w?.is_cwl),
        season: (w?.season as string | null) ?? null,
        round: (w?.round as number | null) ?? null,
        opponentName: (w?.opponent_name as string | null) ?? null,
        startTime: (w?.start_time as string | null) ?? null,
        attacksUsed: (m.attacks_used as number | null) ?? 0,
        stars: (m.stars as number | null) ?? 0,
      };
    })
    .sort((a, b) => new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime());

  const seasonMap = new Map<string, MemberSeasonStat>();
  for (const w of wars) {
    if (!w.isCwl || !w.season) continue;
    if (!seasonMap.has(w.season))
      seasonMap.set(w.season, { season: w.season, rounds: 0, attacks: 0, missed: 0, stars: 0 });
    const s = seasonMap.get(w.season)!;
    s.rounds++;
    s.attacks += w.attacksUsed;
    s.stars += w.stars;
    const ended = (warById.get(w.warId)?.state as string) === "warEnded";
    if (w.attacksUsed === 0 && ended) s.missed++;
  }
  const seasons = [...seasonMap.values()].sort((a, b) => b.season.localeCompare(a.season));

  return { wars, seasons };
}

// Desglose de espejo/remate/robo de un miembro en sus últimas guerras. Clasifica
// cada ataque suyo con el contexto de la guerra (orden global + ventana de 5h).
export interface MirrorStats {
  attacks: number;
  mirror: number;
  cleanup: number;
  late: number;
  stolen: number;
  offmirror: number;
}
const EMPTY_MIRROR: MirrorStats = {
  attacks: 0,
  mirror: 0,
  cleanup: 0,
  late: 0,
  stolen: 0,
  offmirror: 0,
};

export async function getMemberMirrorStats(tag: string, limit = 20): Promise<MirrorStats> {
  const supabase = createServerClient();
  const { data: wm } = await supabase
    .from("war_members")
    .select("war_id")
    .eq("tag", tag)
    .limit(2000);
  if (!wm || wm.length === 0) return { ...EMPTY_MIRROR };

  const ids = [...new Set(wm.map((m) => m.war_id as number))];
  const { data: warRows } = await supabase
    .from("wars")
    .select("id, is_cwl, end_time, start_time")
    .in("id", ids)
    .order("start_time", { ascending: false })
    .limit(limit);
  if (!warRows || warRows.length === 0) return { ...EMPTY_MIRROR };
  const warIds = warRows.map((w) => w.id as number);
  const warMeta = new Map(warRows.map((w) => [w.id as number, w]));

  const { data: atks } = await supabase
    .from("war_attacks")
    .select("war_id, attacker_tag, defender_tag, attack_order, is_mirror, defender_position, first_seen_at")
    .in("war_id", warIds)
    .limit(20000);

  const byWar = new Map<number, Record<string, unknown>[]>();
  for (const a of atks ?? []) {
    const w = a.war_id as number;
    if (!byWar.has(w)) byWar.set(w, []);
    byWar.get(w)!.push(a);
  }

  const window = stealWindowMs((await getRulesConfig()).stealWindowHours);
  const stats: MirrorStats = { ...EMPTY_MIRROR };
  for (const [wid, list] of byWar) {
    const meta = warMeta.get(wid);
    if (!meta) continue;
    const isCwl = Boolean(meta.is_cwl);
    const endMs = meta.end_time ? Date.parse(meta.end_time as string) : null;
    const firstOrder = new Map<string, number>();
    for (const a of list) {
      const dt = a.defender_tag as string | null;
      if (!dt) continue;
      const o = (a.attack_order as number | null) ?? 0;
      const prev = firstOrder.get(dt);
      if (prev == null || o < prev) firstOrder.set(dt, o);
    }
    for (const a of list) {
      if ((a.attacker_tag as string) !== tag) continue;
      const dt = a.defender_tag as string | null;
      const order = (a.attack_order as number | null) ?? 0;
      const seen = a.first_seen_at ? Date.parse(a.first_seen_at as string) : null;
      const st = classifyAttackStatus({
        isMirror: (a.is_mirror as boolean | null) ?? null,
        defenderPosition: (a.defender_position as number | null) ?? null,
        fresh: !!dt && firstOrder.get(dt) === order,
        isCwl,
        endMs,
        seenMs: seen,
        stealWindowMs: window,
      });
      if (!st) continue;
      stats.attacks++;
      if (st === "mirror") stats.mirror++;
      else if (st === "cleanup") stats.cleanup++;
      else if (st === "late") stats.late++;
      else if (st === "stolen") stats.stolen++;
      else if (st === "offmirror") stats.offmirror++;
    }
  }
  return stats;
}

// Detalle de una guerra: cabecera + alineación de nuestro clan.
export async function getWarDetail(
  id: number,
): Promise<{ war: WarSummary; members: WarMemberDetail[] } | null> {
  const supabase = createServerClient();
  const { data: war } = await supabase.from("wars").select(WAR_COLS).eq("id", id).maybeSingle();
  if (!war) return null;

  const [{ data: members }, { data: atks }] = await Promise.all([
    supabase
      .from("war_members")
      .select("tag, name, map_position, town_hall, attacks_used, stars, destruction")
      .eq("war_id", id)
      .order("map_position", { ascending: true }),
    supabase
      .from("war_attacks")
      .select("*")
      .eq("war_id", id)
      .order("attack_order", { ascending: true }),
  ]);

  // Contexto para clasificar espejo/remate/robo: primer ataque a cada base (por
  // orden) y el nombre de nuestro miembro en cada posición (dueño del espejo).
  const firstOrderByDefender = new Map<string, number>();
  for (const a of atks ?? []) {
    const dt = a.defender_tag as string | null;
    if (!dt) continue;
    const o = (a.attack_order as number | null) ?? 0;
    const prev = firstOrderByDefender.get(dt);
    if (prev == null || o < prev) firstOrderByDefender.set(dt, o);
  }
  const nameByPosition = new Map<number, string>();
  for (const m of members ?? []) {
    const pos = m.map_position as number | null;
    if (pos != null) nameByPosition.set(pos, m.name as string);
  }
  const wr = war as Record<string, unknown>;
  const isCwl = Boolean(wr.is_cwl);
  const endTimeIso = (wr.end_time as string | null) ?? null;
  const endMs = endTimeIso ? Date.parse(endTimeIso) : NaN;
  const endMsOrNull = Number.isNaN(endMs) ? null : endMs;
  const window = stealWindowMs((await getRulesConfig()).stealWindowHours);

  // Agrupa los ataques individuales por atacante (nuestro miembro).
  const attacksByTag = new Map<string, WarAttackDetail[]>();
  for (const a of atks ?? []) {
    const tag = a.attacker_tag as string;
    if (!attacksByTag.has(tag)) attacksByTag.set(tag, []);
    const order = (a.attack_order as number | null) ?? 0;
    const defenderPosition = (a.defender_position as number | null) ?? null;
    const isMirror = (a.is_mirror as boolean | null) ?? null;
    const defenderTag = a.defender_tag as string | null;
    const seenIso = (a.first_seen_at as string | null) ?? null;
    const seenMs = seenIso ? Date.parse(seenIso) : null;

    // Clasificación con la ventana de 5h (solo si hay datos; guerras antiguas → null).
    const mirrorStatus: MirrorStatus | null = classifyAttackStatus({
      isMirror,
      defenderPosition,
      fresh: !!defenderTag && firstOrderByDefender.get(defenderTag) === order,
      isCwl,
      endMs: endMsOrNull,
      seenMs: Number.isNaN(seenMs as number) ? null : seenMs,
      stealWindowMs: window,
    });
    const stolenFrom =
      mirrorStatus === "stolen" && defenderPosition != null
        ? (nameByPosition.get(defenderPosition) ?? null)
        : null;

    attacksByTag.get(tag)!.push({
      stars: (a.stars as number | null) ?? 0,
      destruction: Number(a.destruction ?? 0),
      order,
      duration: (a.duration as number | null) ?? null,
      defenderName: (a.defender_name as string | null) ?? null,
      defenderPosition,
      defenderTh: (a.defender_th as number | null) ?? null,
      isMirror,
      mirrorStatus,
      stolenFrom,
    });
  }

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
      attacks: attacksByTag.get(m.tag as string) ?? [],
    })),
  };
}
