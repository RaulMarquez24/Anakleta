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

export interface InactivityRow {
  tag: string;
  name: string;
  role: string | null;
  lastChangeAt: string | null; // último cambio "real" observado
  staleDays: number | null; // días sin cambios (null si no hay histórico)
}

export interface ActivityReport {
  windowDays: number;
  inactivity: InactivityRow[]; // ordenado por staleDays desc (más sospechoso primero)
  altas: { tag: string; name: string; firstSeenAt: string }[];
  bajas: { tag: string; name: string; lastSeenAt: string }[];
}

// Inactividad refinada: recorre los snapshots de cada miembro en la ventana y
// busca el último cambio "real". Un cambio real = las donaciones SUBEN
// (delta > 0) o los trofeos varían. Una BAJADA de donaciones se ignora: es el
// reseteo de temporada, no inactividad. Cuanto más tiempo sin cambios, más
// sospechoso.
export async function getActivityReport(windowDays = 7): Promise<ActivityReport> {
  const supabase = createServerClient();
  const now = Date.now();
  const since = new Date(now - windowDays * DAY_MS).toISOString();

  const { data: members } = await supabase
    .from("members")
    .select("tag, name, role, is_active, first_seen_at, last_seen_at");

  const active = (members ?? []).filter((m) => m.is_active);

  const { data: snaps } = await supabase
    .from("member_snapshots")
    .select("member_tag, captured_at, donations, trophies")
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });

  // Agrupa snapshots por miembro.
  const byTag = new Map<
    string,
    { capturedAt: string; donations: number | null; trophies: number | null }[]
  >();
  for (const s of snaps ?? []) {
    const tag = s.member_tag as string;
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag)!.push({
      capturedAt: s.captured_at as string,
      donations: (s.donations as number | null) ?? null,
      trophies: (s.trophies as number | null) ?? null,
    });
  }

  const inactivity: InactivityRow[] = active.map((m) => {
    const rows = byTag.get(m.tag as string) ?? [];
    let lastChangeAt: string | null = null;
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      const donationsUp = (cur.donations ?? 0) > (prev.donations ?? 0);
      const trophiesChanged = cur.trophies !== prev.trophies;
      if (donationsUp || trophiesChanged) lastChangeAt = cur.capturedAt;
    }
    const staleDays =
      lastChangeAt != null
        ? (now - new Date(lastChangeAt).getTime()) / DAY_MS
        : rows.length > 0
          ? (now - new Date(rows[0].capturedAt).getTime()) / DAY_MS
          : null;
    return {
      tag: m.tag as string,
      name: m.name as string,
      role: (m.role as string | null) ?? null,
      lastChangeAt,
      staleDays: staleDays != null ? Math.round(staleDays * 10) / 10 : null,
    };
  });

  inactivity.sort((a, b) => (b.staleDays ?? -1) - (a.staleDays ?? -1));

  const altas = (members ?? [])
    .filter(
      (m) =>
        m.is_active &&
        m.first_seen_at &&
        new Date(m.first_seen_at as string).getTime() >= now - windowDays * DAY_MS,
    )
    .map((m) => ({
      tag: m.tag as string,
      name: m.name as string,
      firstSeenAt: m.first_seen_at as string,
    }))
    .sort((a, b) => new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime());

  const bajas = (members ?? [])
    .filter(
      (m) =>
        !m.is_active &&
        m.last_seen_at &&
        new Date(m.last_seen_at as string).getTime() >= now - 30 * DAY_MS,
    )
    .map((m) => ({
      tag: m.tag as string,
      name: m.name as string,
      lastSeenAt: m.last_seen_at as string,
    }))
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  return { windowDays, inactivity, altas, bajas };
}
