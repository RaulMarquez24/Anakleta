import { createServerClient } from "@/lib/supabase/server";
import { donationsNegative } from "@/lib/dashboard";
import { getActiveWarnCounts, getWarnConfig } from "@/lib/warns";
import { classifyAttackStatus } from "@/lib/war";
import { getRulesConfig, stealWindowMs } from "@/lib/rules";

const DAY_MS = 86_400_000;

export interface MemberHistory {
  tag: string;
  name: string;
  role: string | null;
  townHall: number | null;
  isActive: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  note: string | null; // comentario manual
  noteBy: string | null;
  noteAt: string | null;
  mainTag: string | null; // si es secundaria: tag de su cuenta principal
  discordId: string | null; // cuenta de Discord vinculada (para avisos)
  discordUsername: string | null;
  returnedAt: string | null; // si volvió tras estar de baja
  returnReviewed: boolean; // si ya se revisó su vuelta
  // Valores más recientes (última captura):
  current: {
    leagueTierName: string | null;
    leagueTierIcon: string | null;
    expLevel: number | null;
    trophies: number | null;
    builderTrophies: number | null;
    warStars: number | null;
    attackWins: number | null;
    defenseWins: number | null;
    warPreference: string | null;
    capitalContributions: number | null;
  };
  snapshots: {
    capturedAt: string;
    donations: number | null;
    donationsReceived: number | null;
    trophies: number | null;
  }[];
}

// Sin caché a propósito: la ficha muestra datos que cambian por fuera (nota,
// Discord vinculado por el bot, cuentas). Lectura directa a Supabase en cada
// visita para que nunca salga desactualizada (la página es force-dynamic).
export async function getMemberHistory(tag: string): Promise<MemberHistory | null> {
  const supabase = createServerClient();

  const { data: member } = await supabase
    .from("members")
    .select("*") // "*" para no romper si aún no está migrada la columna note
    .eq("tag", tag)
    .maybeSingle();

  if (!member) return null;

  const { data: snaps } = await supabase
    .from("member_snapshots")
    .select(
      "captured_at, donations, donations_received, trophies, builder_trophies, league_tier_name, league_tier_icon, exp_level, war_stars, attack_wins, defense_wins, war_preference, capital_contributions",
    )
    .eq("member_tag", tag)
    .order("captured_at", { ascending: true });

  const rows = snaps ?? [];
  const last = rows[rows.length - 1];

  return {
    tag: member.tag as string,
    name: member.name as string,
    role: (member.role as string | null) ?? null,
    townHall: (member.town_hall as number | null) ?? null,
    isActive: Boolean(member.is_active),
    firstSeenAt: (member.first_seen_at as string | null) ?? null,
    lastSeenAt: (member.last_seen_at as string | null) ?? null,
    note: (member.note as string | null) ?? null,
    noteBy: (member.note_by as string | null) ?? null,
    noteAt: (member.note_at as string | null) ?? null,
    mainTag: (member.main_tag as string | null) ?? null,
    discordId: (member.discord_id as string | null) ?? null,
    discordUsername: (member.discord_username as string | null) ?? null,
    returnedAt: (member.returned_at as string | null) ?? null,
    returnReviewed: member.return_reviewed !== false, // default true si no está migrado
    current: {
      leagueTierName: (last?.league_tier_name as string | null) ?? null,
      leagueTierIcon: (last?.league_tier_icon as string | null) ?? null,
      expLevel: (last?.exp_level as number | null) ?? null,
      trophies: (last?.trophies as number | null) ?? null,
      builderTrophies: (last?.builder_trophies as number | null) ?? null,
      warStars: (last?.war_stars as number | null) ?? null,
      attackWins: (last?.attack_wins as number | null) ?? null,
      defenseWins: (last?.defense_wins as number | null) ?? null,
      warPreference: (last?.war_preference as string | null) ?? null,
      capitalContributions: (last?.capital_contributions as number | null) ?? null,
    },
    snapshots: rows.map((s) => ({
      capturedAt: s.captured_at as string,
      donations: (s.donations as number | null) ?? null,
      donationsReceived: (s.donations_received as number | null) ?? null,
      trophies: (s.trophies as number | null) ?? null,
    })),
  };
}

export interface Returnee {
  tag: string;
  name: string;
  returnedAt: string | null;
  note: string | null;
  activeWarns: number;
}

// Miembros que volvieron tras estar de baja y aún NO se han revisado. Para el
// aviso del panel (revisar su nota/warns de la etapa anterior).
export async function getReturnees(): Promise<Returnee[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("members")
      .select("tag, name, returned_at, note")
      .eq("is_active", true)
      .eq("return_reviewed", false)
      .not("returned_at", "is", null)
      .order("returned_at", { ascending: false });
    if (!data || data.length === 0) return [];
    const warnCounts = await getActiveWarnCounts();
    return data.map((m) => ({
      tag: m.tag as string,
      name: m.name as string,
      returnedAt: (m.returned_at as string | null) ?? null,
      note: (m.note as string | null) ?? null,
      activeWarns: warnCounts.get(m.tag as string) ?? 0,
    }));
  } catch {
    return [];
  }
}

export interface ActivitySignal {
  key: string;
  icon: string;
  label: string;
  at: string; // última vez que subió esta señal
}

export type ActivityCategory = "expulsion" | "revisar" | "destacado" | "ok" | "mando";

export interface ActivityRow {
  tag: string;
  name: string;
  role: string | null;
  isNew: boolean;
  townHall: number | null;
  leagueTierId: number | null; // rango real (monótono): mayor = mejor liga
  leagueTierName: string | null;
  leagueTierIcon: string | null;
  trophies: number | null; // copas actuales (se resetean cada semana; solo display)
  // Liga comparada con los del mismo TH en el clan.
  leagueVsTh: "muy_alta" | "alta" | "normal" | "baja" | "muy_baja" | null;
  donationsTrend: "up" | "down" | "flat" | null; // vs periodo anterior
  lastActivityAt: string | null; // última señal de actividad detectada
  staleDays: number | null; // días desde la última actividad (null si no hay histórico)
  capped: boolean; // true si podría llevar más (lo topamos a la ventana de análisis)
  recent: ActivitySignal[]; // qué señales se movieron, más recientes primero
  donations: number | null;
  donationsReceived: number | null;
  ratio: number | null;
  donationNegative: boolean; // cuenta negativo (leeching) según la regla
  warsPlayed: number; // rondas/guerras del periodo en las que estuvo alineado
  warAttacks: number; // ataques usados en guerra el periodo
  warMissed: number; // rondas TERMINADAS alineado sin atacar (periodo)
  missedRounds: number[]; // qué rondas de CWL falló (terminadas)
  warStars: number; // estrellas de guerra del periodo
  warStolen: number; // robos de espejo (infracción) en el periodo
  capitalParticipated: number; // findes de capital en los que atacó
  capitalWeekends: number; // findes de capital registrados en el periodo (clan)
  category: ActivityCategory;
  kickScore: number; // mayor = más candidato a echar
  participationScore: number; // mayor = más participativo (candidato a subir)
  flags: string[]; // "faltillas" detectadas (no dona, no guerra, no sube liga, guerra off)
  activeWarns: number; // warns vigentes (amonestaciones) del miembro
}

export type ActivityPeriod = "semana" | "mes" | "todo";

// Etiqueta e icono de cada señal, para explicar "por qué está activo".
const SIGNAL_META: Record<(typeof SIGNALS)[number], { icon: string; label: string }> = {
  donations: { icon: "🎁", label: "Donó" },
  donations_received: { icon: "📥", label: "Pidió tropas" },
  attack_wins: { icon: "⚔️", label: "Atacó" },
  war_stars: { icon: "⭐", label: "Guerra" },
  capital_contributions: { icon: "🏛️", label: "Capital" },
  exp_level: { icon: "⬆️", label: "Subió nivel" },
};

export interface ActivityReport {
  period: ActivityPeriod;
  periodLabel: string; // "esta semana", "este mes", "todo el histórico"
  thresholdDays: number;
  warsInPeriod: number; // nº de guerras del clan en el periodo
  clanDonations: number; // donaciones totales del clan en el periodo
  clanWarStars: number; // estrellas de guerra totales del clan en el periodo
  members: ActivityRow[]; // ordenado por kickScore desc (candidatos a echar primero)
}

// Inicio del periodo (en UTC; el desfase con Madrid es <2h, irrelevante para
// contar actividad). Semana = lunes; Mes = día 1; Todo = desde siempre.
function periodStartMs(period: ActivityPeriod): number {
  const now = new Date();
  if (period === "todo") return 0;
  if (period === "mes") return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const dow = (now.getUTCDay() + 6) % 7; // 0 = lunes
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow);
}

const PERIOD_LABEL: Record<ActivityPeriod, string> = {
  semana: "esta semana (L-D)",
  mes: "este mes",
  todo: "todo el histórico",
};

export interface Departure {
  tag: string;
  name: string;
  role: string | null;
  townHall: number | null;
  firstSeenAt: string | null; // cuándo entró (aprox.)
  lastSeenAt: string | null; // última vez visto antes de irse
  note: string | null; // comentario manual (p. ej. "expulsado por X")
  noteBy: string | null; // quién puso la nota
  noteAt: string | null; // cuándo
}

// Registro de abandonos: todos los que ya no están en el clan (is_active=false),
// del más reciente al más antiguo.
export async function getDepartures(): Promise<Departure[]> {
  const supabase = createServerClient();
  // select("*") a propósito: así no rompe si aún no está migrada la columna note.
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", false)
    .order("last_seen_at", { ascending: false });
  return (data ?? []).map((m) => ({
    tag: m.tag as string,
    name: m.name as string,
    role: (m.role as string | null) ?? null,
    townHall: (m.town_hall as number | null) ?? null,
    firstSeenAt: (m.first_seen_at as string | null) ?? null,
    lastSeenAt: (m.last_seen_at as string | null) ?? null,
    note: (m.note as string | null) ?? null,
    noteBy: (m.note_by as string | null) ?? null,
    noteAt: (m.note_at as string | null) ?? null,
  }));
}


// Contadores que, si SUBEN entre dos capturas, prueban que la persona estuvo
// online: donar, atacar en multi (attackWins), estrellas de guerra, aporte a la
// capital, XP, y pedir tropas. Solo miramos subidas: una bajada de donaciones es
// el reseteo de temporada, no inactividad.
// OJO: las copas (trophies) NO van aquí. Suben también cuando te atacan y te
// defiendes, así que un cambio de copas no prueba que la persona jugara. Lo que
// importa de las copas es el nivel SEMANAL (rango de liga + si hizo copas esta
// semana), no el movimiento diario. Se leen aparte (lastTrophies) para el flag.
const SIGNALS = [
  "donations",
  "donations_received",
  "attack_wins",
  "war_stars",
  "capital_contributions",
  "exp_level",
] as const;

type SignalRow = { capturedAt: string } & Record<(typeof SIGNALS)[number], number | null>;

// Última actividad detectada (multi-señal) + participación en guerra del último mes.
export async function getActivityReport(
  period: ActivityPeriod = "semana",
): Promise<ActivityReport> {
  const supabase = createServerClient();
  const now = Date.now();
  const since = new Date(periodStartMs(period)).toISOString();
  const rules = await getRulesConfig();
  const thresholdDays = rules.inactivityDays; // días de inactividad → "revisar"
  const stealWinMs = stealWindowMs(rules.stealWindowHours);

  const { data: members } = await supabase
    .from("members")
    .select("tag, name, role, is_active, first_seen_at")
    .eq("is_active", true);
  const active = members ?? [];

  // Línea base del tracking para detectar "nuevos" reales (ver dashboard).
  const firstSeens = active
    .map((m) => (m.first_seen_at ? new Date(m.first_seen_at as string).getTime() : null))
    .filter((t): t is number => t != null);
  const baseline = firstSeens.length ? Math.min(...firstSeens) : now;

  // Snapshots de la ventana con todas las señales.
  const { data: snaps } = await supabase
    .from("member_snapshots")
    .select(
      `member_tag, captured_at, war_preference, town_hall, trophies, league_tier_id, league_tier_name, league_tier_icon, ${SIGNALS.join(", ")}`,
    )
    .gte("captured_at", since)
    .order("captured_at", { ascending: true })
    .limit(50000);

  const byTag = new Map<string, SignalRow[]>();
  const lastWarPref = new Map<string, string | null>();
  const lastTH = new Map<string, number | null>();
  const lastTrophies = new Map<string, number | null>();
  const lastTierId = new Map<string, number | null>();
  const lastTier = new Map<string, { name: string | null; icon: string | null }>();
  for (const s of (snaps ?? []) as unknown as Record<string, unknown>[]) {
    const tag = s.member_tag as string;
    if (!byTag.has(tag)) byTag.set(tag, []);
    const row = { capturedAt: s.captured_at as string } as SignalRow;
    for (const k of SIGNALS) row[k] = (s[k] as number | null) ?? null;
    byTag.get(tag)!.push(row);
    lastWarPref.set(tag, (s.war_preference as string | null) ?? null);
    lastTH.set(tag, (s.town_hall as number | null) ?? null);
    lastTrophies.set(tag, (s.trophies as number | null) ?? null);
    lastTierId.set(tag, (s.league_tier_id as number | null) ?? null);
    lastTier.set(tag, {
      name: (s.league_tier_name as string | null) ?? null,
      icon: (s.league_tier_icon as string | null) ?? null,
    });
  }

  // Baseline liga-vs-TH: rango de cada tier (ordenado) y mediana por TH del clan.
  const rankOfTier = new Map<number, number>();
  [...new Set([...lastTierId.values()].filter((v): v is number => v != null))]
    .sort((a, b) => a - b)
    .forEach((id, i) => rankOfTier.set(id, i));
  const ranksByTH = new Map<number, number[]>();
  for (const m of active) {
    const th = lastTH.get(m.tag as string);
    const tid = lastTierId.get(m.tag as string);
    if (th != null && tid != null && rankOfTier.has(tid)) {
      if (!ranksByTH.has(th)) ranksByTH.set(th, []);
      ranksByTH.get(th)!.push(rankOfTier.get(tid)!);
    }
  }
  const medianRankByTH = new Map<number, number>();
  for (const [th, ranks] of ranksByTH) {
    const s = [...ranks].sort((a, b) => a - b);
    const n = s.length;
    medianRankByTH.set(th, n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2);
  }

  // Donaciones del periodo ANTERIOR (para la tendencia). Semana→semana previa,
  // Mes→mes previo, Todo→sin comparación.
  const prevDon = new Map<string, number>();
  let prevHasData = false;
  if (period !== "todo") {
    const curStart = periodStartMs(period);
    const d = new Date(curStart);
    const prevStart =
      period === "mes"
        ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)
        : curStart - 7 * DAY_MS;
    const { data: prevSnaps } = await supabase
      .from("member_snapshots")
      .select("member_tag, captured_at, donations")
      .gte("captured_at", new Date(prevStart).toISOString())
      .lt("captured_at", new Date(curStart).toISOString())
      .order("captured_at", { ascending: true })
      .limit(50000);
    prevHasData = (prevSnaps?.length ?? 0) > 0;
    const prevByTag = new Map<string, number[]>();
    for (const s of prevSnaps ?? []) {
      const tag = s.member_tag as string;
      if (!prevByTag.has(tag)) prevByTag.set(tag, []);
      prevByTag.get(tag)!.push((s.donations as number | null) ?? 0);
    }
    for (const [tag, vals] of prevByTag) {
      let sum = 0;
      for (let i = 1; i < vals.length; i++) if (vals[i] > vals[i - 1]) sum += vals[i] - vals[i - 1];
      prevDon.set(tag, sum);
    }
  }

  // Participación en guerra del último mes (desde la alineación war_members).
  // Un "sin atacar" SOLO cuenta si la guerra ya terminó: la ronda en curso no
  // penaliza (aún queda tiempo).
  const { data: warRows } = await supabase
    .from("wars")
    .select("id, state, round, end_time, is_cwl")
    .gte("start_time", since);
  const warIds = (warRows ?? []).map((w) => w.id as number);
  const warsInPeriod = warIds.length;
  const warState = new Map<number, string>();
  const warRound = new Map<number, number | null>();
  const warEndMs = new Map<number, number | null>();
  const warIsCwl = new Map<number, boolean>();
  for (const w of warRows ?? []) {
    warState.set(w.id as number, (w.state as string) ?? "");
    warRound.set(w.id as number, (w.round as number | null) ?? null);
    warEndMs.set(w.id as number, w.end_time ? Date.parse(w.end_time as string) : null);
    warIsCwl.set(w.id as number, Boolean(w.is_cwl));
  }

  interface WarStat {
    played: number;
    attacks: number;
    missed: number;
    missedRounds: number[];
    stars: number;
  }
  const warStat = new Map<string, WarStat>();
  if (warIds.length > 0) {
    const { data: wm } = await supabase
      .from("war_members")
      .select("war_id, tag, attacks_used, stars")
      .in("war_id", warIds)
      .limit(50000);
    for (const m of wm ?? []) {
      const tag = m.tag as string;
      const wid = m.war_id as number;
      if (!warStat.has(tag)) warStat.set(tag, { played: 0, attacks: 0, missed: 0, missedRounds: [], stars: 0 });
      const s = warStat.get(tag)!;
      const used = (m.attacks_used as number | null) ?? 0;
      s.played++;
      s.attacks += used;
      s.stars += (m.stars as number | null) ?? 0;
      // Solo cuenta como fallo si la guerra terminó.
      if (used === 0 && warState.get(wid) === "warEnded") {
        s.missed++;
        const r = warRound.get(wid);
        if (r != null) s.missedRounds.push(r);
      }
    }
    for (const s of warStat.values()) s.missedRounds.sort((a, b) => a - b);
  }

  // Robos de espejo (infracción) por miembro en las guerras del periodo. Se
  // clasifica cada ataque con el contexto de su guerra (orden global + ventana 5h).
  const stolenByTag = new Map<string, number>();
  if (warIds.length > 0) {
    const { data: atks } = await supabase
      .from("war_attacks")
      .select("war_id, attacker_tag, defender_tag, attack_order, is_mirror, defender_position, first_seen_at, mirror_status")
      .in("war_id", warIds)
      .limit(50000);
    const byWar = new Map<number, Record<string, unknown>[]>();
    for (const a of atks ?? []) {
      const w = a.war_id as number;
      if (!byWar.has(w)) byWar.set(w, []);
      byWar.get(w)!.push(a);
    }
    for (const [wid, list] of byWar) {
      const firstOrder = new Map<string, number>();
      for (const a of list) {
        const dt = a.defender_tag as string | null;
        if (!dt) continue;
        const o = (a.attack_order as number | null) ?? 0;
        const prev = firstOrder.get(dt);
        if (prev == null || o < prev) firstOrder.set(dt, o);
      }
      for (const a of list) {
        const dt = a.defender_tag as string | null;
        const order = (a.attack_order as number | null) ?? 0;
        const st =
          (a.mirror_status as string | null) ??
          classifyAttackStatus({
            isMirror: (a.is_mirror as boolean | null) ?? null,
            defenderPosition: (a.defender_position as number | null) ?? null,
            fresh: !!dt && firstOrder.get(dt) === order,
            isCwl: warIsCwl.get(wid) ?? false,
            endMs: warEndMs.get(wid) ?? null,
            seenMs: a.first_seen_at ? Date.parse(a.first_seen_at as string) : null,
            stealWindowMs: stealWinMs,
          });
        if (st === "stolen") {
          const tag = a.attacker_tag as string;
          stolenByTag.set(tag, (stolenByTag.get(tag) ?? 0) + 1);
        }
      }
    }
  }

  // Participación en asaltos de capital durante el periodo (findes registrados).
  const capitalParticipated = new Map<string, number>();
  let capitalWeekends = 0;
  {
    const { data: raids } = await supabase
      .from("capital_raids")
      .select("id")
      .gte("start_time", since);
    const raidIds = (raids ?? []).map((r) => r.id as number);
    capitalWeekends = raidIds.length;
    if (raidIds.length > 0) {
      const { data: crm } = await supabase
        .from("capital_raid_members")
        .select("raid_id, tag, attacks")
        .in("raid_id", raidIds)
        .limit(50000);
      const seen = new Set<string>(); // tag+raid, por si hubiera duplicados
      for (const r of crm ?? []) {
        const tag = r.tag as string;
        const key = `${tag}-${r.raid_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (((r.attacks as number | null) ?? 0) > 0)
          capitalParticipated.set(tag, (capitalParticipated.get(tag) ?? 0) + 1);
      }
    }
  }

  const [warnCounts, warnCfg] = await Promise.all([getActiveWarnCounts(), getWarnConfig()]);

  const rowsOut: ActivityRow[] = active.map((m) => {
    const tag = m.tag as string;
    const role = (m.role as string | null) ?? null;
    const snapRows = byTag.get(tag) ?? [];

    // Última señal de cada tipo + donaciones DEL PERIODO (suma de subidas).
    const lastBySignal: Partial<Record<(typeof SIGNALS)[number], string>> = {};
    let donationsPeriod = 0;
    let receivedPeriod = 0;
    for (let i = 1; i < snapRows.length; i++) {
      const prev = snapRows[i - 1];
      const cur = snapRows[i];
      for (const k of SIGNALS) {
        const a = prev[k];
        const b = cur[k];
        if (a != null && b != null && b > a) lastBySignal[k] = cur.capturedAt;
      }
      const dDon = (cur.donations ?? 0) - (prev.donations ?? 0);
      if (dDon > 0) donationsPeriod += dDon;
      const dRec = (cur.donations_received ?? 0) - (prev.donations_received ?? 0);
      if (dRec > 0) receivedPeriod += dRec;
    }
    const recent: ActivitySignal[] = SIGNALS.filter((k) => lastBySignal[k])
      .map((k) => ({ key: k, icon: SIGNAL_META[k].icon, label: SIGNAL_META[k].label, at: lastBySignal[k]! }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const lastActivityAt = recent[0]?.at ?? null;
    let staleDays: number | null = null;
    let capped = false;
    if (lastActivityAt != null) {
      staleDays = (now - new Date(lastActivityAt).getTime()) / DAY_MS;
    } else if (snapRows.length > 0) {
      staleDays = (now - new Date(snapRows[0].capturedAt).getTime()) / DAY_MS;
      capped = true;
    }
    staleDays = staleDays != null ? Math.round(staleDays * 10) / 10 : null;

    const donations = snapRows.length > 0 ? donationsPeriod : null;
    const received = snapRows.length > 0 ? receivedPeriod : null;
    const ratio = received && received > 0 ? donations! / received : null;
    const donNeg = donationsNegative(donations, received, rules.donationMin, rules.donationGap);
    // Copas actuales (ranked). Se resetea cada lunes: 0 = sin competitivo esta semana.
    const trophies = lastTrophies.get(tag) ?? null;

    // Tendencia de donaciones vs periodo anterior.
    let donationsTrend: "up" | "down" | "flat" | null = null;
    if (prevHasData && donations != null) {
      const diff = donations - (prevDon.get(tag) ?? 0);
      donationsTrend = Math.abs(diff) < 50 ? "flat" : diff > 0 ? "up" : "down";
    }

    // Liga vs. compañeros del mismo TH (requiere ≥3 del mismo TH para comparar).
    let leagueVsTh: ActivityRow["leagueVsTh"] = null;
    const th = lastTH.get(tag);
    const tid = lastTierId.get(tag);
    if (th != null && tid != null && rankOfTier.has(tid) && (ranksByTH.get(th)?.length ?? 0) >= 3) {
      const dev = rankOfTier.get(tid)! - (medianRankByTH.get(th) ?? 0);
      leagueVsTh =
        dev >= 5 ? "muy_alta" : dev >= 2 ? "alta" : dev <= -5 ? "muy_baja" : dev <= -2 ? "baja" : "normal";
    }

    const w = warStat.get(tag) ?? { played: 0, attacks: 0, missed: 0, missedRounds: [], stars: 0 };

    const fs = m.first_seen_at ? new Date(m.first_seen_at as string).getTime() : null;
    const isNew = fs != null && now - fs < 7 * DAY_MS && fs - baseline > 12 * 3_600_000;

    // Faltillas: señales concretas de poca implicación (solo si hay datos suficientes).
    const enoughData = snapRows.length >= 2;
    const flags: string[] = [];
    if (enoughData && donationsPeriod === 0 && receivedPeriod === 0) flags.push("🚫 No dona ni pide");
    if (warsInPeriod > 0 && w.played === 0) flags.push("🚫 No juega guerras");
    if (trophies != null && trophies === 0) flags.push("🎯 Sin competitivo esta semana");
    if (lastWarPref.get(tag) === "out") flags.push("💤 Guerra desactivada");
    const warStolen = stolenByTag.get(tag) ?? 0;
    if (warStolen > 0) flags.push(`🎯 ${warStolen} robó espejo`);
    const capPart = capitalParticipated.get(tag) ?? 0;
    if (capitalWeekends > 0 && capPart === 0 && !isNew) flags.push("🏛️ Sin capital");
    const activeWarns = warnCounts.get(tag) ?? 0;
    if (activeWarns > 0) flags.push(`⚠️ ${activeWarns} warn${activeWarns === 1 ? "" : "s"}`);

    const isStaff = role === "leader" || role === "coLeader";
    let category: ActivityCategory;
    if (isStaff) category = "mando";
    else if (
      (staleDays != null && staleDays >= 14) ||
      w.missed >= 3 ||
      flags.length >= 3 ||
      activeWarns >= warnCfg.threshold
    )
      category = "expulsion";
    else if (
      (staleDays != null && staleDays >= thresholdDays) ||
      w.missed >= 1 ||
      donNeg ||
      flags.length >= 2
    )
      category = "revisar";
    else if (
      staleDays != null &&
      staleDays < 2 &&
      w.missed === 0 &&
      flags.length === 0 &&
      // Destacar EXIGE aporte real de donaciones (> 1000) además de activo y sin fallos.
      donations != null &&
      donations > 1000
    )
      category = "destacado";
    else category = "ok";

    let kickScore = -1;
    if (!isStaff) {
      kickScore =
        Math.min(staleDays ?? 0, 30) +
        w.missed * 8 +
        warStolen * 5 +
        (donNeg ? 8 : 0) +
        (staleDays != null && staleDays >= thresholdDays ? 10 : 0) +
        flags.length * 4 +
        activeWarns * 6;
    }

    return {
      tag,
      name: m.name as string,
      role,
      isNew,
      townHall: lastTH.get(tag) ?? null,
      leagueTierId: lastTierId.get(tag) ?? null,
      leagueTierName: lastTier.get(tag)?.name ?? null,
      leagueTierIcon: lastTier.get(tag)?.icon ?? null,
      trophies,
      leagueVsTh,
      donationsTrend,
      lastActivityAt,
      staleDays,
      capped,
      recent,
      donations,
      donationsReceived: received,
      ratio,
      donationNegative: donNeg,
      warsPlayed: w.played,
      warAttacks: w.attacks,
      warMissed: w.missed,
      missedRounds: w.missedRounds,
      warStars: w.stars,
      warStolen,
      capitalParticipated: capPart,
      capitalWeekends,
      category,
      kickScore,
      // Participación (para ascensos): donaciones + estrellas + ataques, penaliza fallos.
      participationScore: (donations ?? 0) + w.stars * 100 + w.attacks * 50 - w.missed * 300,
      flags,
      activeWarns,
    };
  });

  rowsOut.sort((a, b) => b.kickScore - a.kickScore || (b.staleDays ?? -1) - (a.staleDays ?? -1));

  const clanDonations = rowsOut.reduce((n, r) => n + (r.donations ?? 0), 0);
  const clanWarStars = rowsOut.reduce((n, r) => n + r.warStars, 0);

  return {
    period,
    periodLabel: PERIOD_LABEL[period],
    thresholdDays: thresholdDays,
    warsInPeriod,
    clanDonations,
    clanWarStars,
    members: rowsOut,
  };
}
