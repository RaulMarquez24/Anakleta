import { createServerClient } from "@/lib/supabase/server";
import { donationsNegative } from "@/lib/dashboard";

const DAY_MS = 86_400_000;

export interface MemberHistory {
  tag: string;
  name: string;
  role: string | null;
  townHall: number | null;
  isActive: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  // Valores más recientes (última captura):
  current: {
    leagueTierName: string | null;
    leagueTierIcon: string | null;
    expLevel: number | null;
    trophies: number | null;
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

export async function getMemberHistory(tag: string): Promise<MemberHistory | null> {
  const supabase = createServerClient();

  const { data: member } = await supabase
    .from("members")
    .select("tag, name, role, town_hall, is_active, first_seen_at, last_seen_at")
    .eq("tag", tag)
    .maybeSingle();

  if (!member) return null;

  const { data: snaps } = await supabase
    .from("member_snapshots")
    .select(
      "captured_at, donations, donations_received, trophies, league_tier_name, league_tier_icon, exp_level, war_stars, attack_wins, defense_wins, war_preference, capital_contributions",
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
    current: {
      leagueTierName: (last?.league_tier_name as string | null) ?? null,
      leagueTierIcon: (last?.league_tier_icon as string | null) ?? null,
      expLevel: (last?.exp_level as number | null) ?? null,
      trophies: (last?.trophies as number | null) ?? null,
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
  category: ActivityCategory;
  kickScore: number; // mayor = más candidato a echar
  participationScore: number; // mayor = más participativo (candidato a subir)
  flags: string[]; // "faltillas" detectadas (no dona, no guerra, no sube liga, guerra off)
}

export type ActivityPeriod = "semana" | "mes" | "todo";

// Etiqueta e icono de cada señal, para explicar "por qué está activo".
const SIGNAL_META: Record<(typeof SIGNALS)[number], { icon: string; label: string }> = {
  donations: { icon: "🎁", label: "Donó" },
  donations_received: { icon: "📥", label: "Pidió tropas" },
  trophies: { icon: "🏆", label: "Copas" },
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
}

// Registro de abandonos: todos los que ya no están en el clan (is_active=false),
// del más reciente al más antiguo.
export async function getDepartures(): Promise<Departure[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("members")
    .select("tag, name, role, town_hall, first_seen_at, last_seen_at")
    .eq("is_active", false)
    .order("last_seen_at", { ascending: false });
  return (data ?? []).map((m) => ({
    tag: m.tag as string,
    name: m.name as string,
    role: (m.role as string | null) ?? null,
    townHall: (m.town_hall as number | null) ?? null,
    firstSeenAt: (m.first_seen_at as string | null) ?? null,
    lastSeenAt: (m.last_seen_at as string | null) ?? null,
  }));
}

const THRESHOLD_DAYS = 7; // a partir de aquí, candidato a limpiar

// Contadores que, si SUBEN entre dos capturas, prueban que la persona estuvo
// online: donar, atacar en multi (copas/attackWins), estrellas de guerra, aporte
// a la capital, XP, y pedir tropas. Solo miramos subidas: una bajada de
// donaciones es el reseteo de temporada, no inactividad.
const SIGNALS = [
  "donations",
  "donations_received",
  "trophies",
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
    .select(`member_tag, captured_at, war_preference, ${SIGNALS.join(", ")}`)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true })
    .limit(50000);

  const byTag = new Map<string, SignalRow[]>();
  const lastWarPref = new Map<string, string | null>(); // preferencia de guerra más reciente
  for (const s of (snaps ?? []) as unknown as Record<string, unknown>[]) {
    const tag = s.member_tag as string;
    if (!byTag.has(tag)) byTag.set(tag, []);
    const row = { capturedAt: s.captured_at as string } as SignalRow;
    for (const k of SIGNALS) row[k] = (s[k] as number | null) ?? null;
    byTag.get(tag)!.push(row);
    lastWarPref.set(tag, (s.war_preference as string | null) ?? null);
  }

  // Participación en guerra del último mes (desde la alineación war_members).
  // Un "sin atacar" SOLO cuenta si la guerra ya terminó: la ronda en curso no
  // penaliza (aún queda tiempo).
  const { data: warRows } = await supabase
    .from("wars")
    .select("id, state, round")
    .gte("start_time", since);
  const warIds = (warRows ?? []).map((w) => w.id as number);
  const warsInPeriod = warIds.length;
  const warState = new Map<number, string>();
  const warRound = new Map<number, number | null>();
  for (const w of warRows ?? []) {
    warState.set(w.id as number, (w.state as string) ?? "");
    warRound.set(w.id as number, (w.round as number | null) ?? null);
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
    const donNeg = donationsNegative(donations, received);

    const w = warStat.get(tag) ?? { played: 0, attacks: 0, missed: 0, missedRounds: [], stars: 0 };

    const fs = m.first_seen_at ? new Date(m.first_seen_at as string).getTime() : null;
    const isNew = fs != null && now - fs < 7 * DAY_MS && fs - baseline > 12 * 3_600_000;

    // Faltillas: señales concretas de poca implicación (solo si hay datos suficientes).
    const enoughData = snapRows.length >= 2;
    const flags: string[] = [];
    if (enoughData && donationsPeriod === 0 && receivedPeriod === 0) flags.push("🚫 No dona ni pide");
    if (warsInPeriod > 0 && w.played === 0) flags.push("🚫 No juega guerras");
    if (enoughData && !lastBySignal.trophies) flags.push("📉 No sube liga");
    if (lastWarPref.get(tag) === "out") flags.push("💤 Guerra desactivada");

    const isStaff = role === "leader" || role === "coLeader";
    let category: ActivityCategory;
    if (isStaff) category = "mando";
    else if ((staleDays != null && staleDays >= 14) || w.missed >= 3 || flags.length >= 3)
      category = "expulsion";
    else if (
      (staleDays != null && staleDays >= THRESHOLD_DAYS) ||
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
        (donNeg ? 8 : 0) +
        (staleDays != null && staleDays >= THRESHOLD_DAYS ? 10 : 0) +
        flags.length * 4;
    }

    return {
      tag,
      name: m.name as string,
      role,
      isNew,
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
      category,
      kickScore,
      // Participación (para ascensos): donaciones + estrellas + ataques, penaliza fallos.
      participationScore: (donations ?? 0) + w.stars * 100 + w.attacks * 50 - w.missed * 300,
      flags,
    };
  });

  rowsOut.sort((a, b) => b.kickScore - a.kickScore || (b.staleDays ?? -1) - (a.staleDays ?? -1));

  const clanDonations = rowsOut.reduce((n, r) => n + (r.donations ?? 0), 0);
  const clanWarStars = rowsOut.reduce((n, r) => n + r.warStars, 0);

  return {
    period,
    periodLabel: PERIOD_LABEL[period],
    thresholdDays: THRESHOLD_DAYS,
    warsInPeriod,
    clanDonations,
    clanWarStars,
    members: rowsOut,
  };
}
