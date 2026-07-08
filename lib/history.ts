import { createServerClient } from "@/lib/supabase/server";

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

export interface InactivityRow {
  tag: string;
  name: string;
  role: string | null;
  lastActivityAt: string | null; // última señal de actividad detectada
  staleDays: number | null; // días desde la última actividad (null si no hay histórico)
  capped: boolean; // true si podría llevar más (lo topamos a la ventana de análisis)
  warsPlayed: number; // guerras del último mes en las que atacó
  warAttacks: number; // ataques totales en guerra el último mes
  recent: ActivitySignal[]; // qué señales se movieron, más recientes primero
}

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
  lookbackDays: number; // ventana de análisis de actividad/guerra
  thresholdDays: number; // umbral para marcar candidato a limpiar
  warsInPeriod: number; // nº de guerras del clan en la ventana
  inactivity: InactivityRow[]; // ordenado por staleDays desc (más sospechoso primero)
}

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

const LOOKBACK_DAYS = 30; // cuánto miramos atrás para actividad y guerra
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
export async function getActivityReport(): Promise<ActivityReport> {
  const supabase = createServerClient();
  const now = Date.now();
  const since = new Date(now - LOOKBACK_DAYS * DAY_MS).toISOString();

  const { data: members } = await supabase
    .from("members")
    .select("tag, name, role, is_active")
    .eq("is_active", true);
  const active = members ?? [];

  // Snapshots de la ventana con todas las señales.
  const { data: snaps } = await supabase
    .from("member_snapshots")
    .select(`member_tag, captured_at, ${SIGNALS.join(", ")}`)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true })
    .limit(50000);

  const byTag = new Map<string, SignalRow[]>();
  for (const s of (snaps ?? []) as unknown as Record<string, unknown>[]) {
    const tag = s.member_tag as string;
    if (!byTag.has(tag)) byTag.set(tag, []);
    const row = { capturedAt: s.captured_at as string } as SignalRow;
    for (const k of SIGNALS) row[k] = (s[k] as number | null) ?? null;
    byTag.get(tag)!.push(row);
  }

  // Participación en guerra del último mes.
  const { data: warRows } = await supabase
    .from("wars")
    .select("id")
    .gte("start_time", since);
  const warIds = (warRows ?? []).map((w) => w.id as number);
  const warsInPeriod = warIds.length;

  const warsPlayedByTag = new Map<string, Set<number>>();
  const warAttacksByTag = new Map<string, number>();
  if (warIds.length > 0) {
    const { data: atk } = await supabase
      .from("war_attacks")
      .select("war_id, attacker_tag")
      .in("war_id", warIds)
      .limit(50000);
    for (const a of atk ?? []) {
      const tag = a.attacker_tag as string;
      if (!warsPlayedByTag.has(tag)) warsPlayedByTag.set(tag, new Set());
      warsPlayedByTag.get(tag)!.add(a.war_id as number);
      warAttacksByTag.set(tag, (warAttacksByTag.get(tag) ?? 0) + 1);
    }
  }

  const inactivity: InactivityRow[] = active.map((m) => {
    const tag = m.tag as string;
    const rows = byTag.get(tag) ?? [];
    // Última vez que subió CADA señal (para explicar por qué está activo).
    const lastBySignal: Partial<Record<(typeof SIGNALS)[number], string>> = {};
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      for (const k of SIGNALS) {
        const a = prev[k];
        const b = cur[k];
        if (a != null && b != null && b > a) lastBySignal[k] = cur.capturedAt;
      }
    }
    const recent: ActivitySignal[] = SIGNALS.filter((k) => lastBySignal[k])
      .map((k) => ({ key: k, icon: SIGNAL_META[k].icon, label: SIGNAL_META[k].label, at: lastBySignal[k]! }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const lastActivityAt = recent[0]?.at ?? null;
    let staleDays: number | null = null;
    let capped = false;
    if (lastActivityAt != null) {
      staleDays = (now - new Date(lastActivityAt).getTime()) / DAY_MS;
    } else if (rows.length > 0) {
      // Sin actividad en toda la ventana: lleva al menos desde la 1ª captura vista.
      staleDays = (now - new Date(rows[0].capturedAt).getTime()) / DAY_MS;
      capped = true;
    }
    return {
      tag,
      name: m.name as string,
      role: (m.role as string | null) ?? null,
      lastActivityAt,
      staleDays: staleDays != null ? Math.round(staleDays * 10) / 10 : null,
      capped,
      warsPlayed: warsPlayedByTag.get(tag)?.size ?? 0,
      warAttacks: warAttacksByTag.get(tag) ?? 0,
      recent,
    };
  });

  inactivity.sort((a, b) => (b.staleDays ?? -1) - (a.staleDays ?? -1));

  return {
    lookbackDays: LOOKBACK_DAYS,
    thresholdDays: THRESHOLD_DAYS,
    warsInPeriod,
    inactivity,
  };
}
