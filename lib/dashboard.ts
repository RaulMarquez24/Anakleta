import { createServerClient } from "@/lib/supabase/server";
import { getActiveWarnCounts } from "@/lib/warns";

// Las donaciones "cuentan negativo" (leeching) solo si donó poco (< 1000) Y le
// han dado bastante más de lo que aportó (recibidas − donadas ≥ 1000). Así no
// penaliza a quien recibió poco, ni a quien dona mucho aunque reciba más.
export function donationsNegative(
  donations: number | null,
  received: number | null,
): boolean {
  if (donations == null || received == null) return false;
  return donations < 1000 && received - donations >= 1000;
}

interface SnapRow {
  member_tag: string;
  captured_at: string;
  donations: number | null;
  donations_received: number | null;
  trophies: number | null;
  town_hall: number | null;
  role: string | null;
  league_tier_id: number | null;
  league_tier_name: string | null;
  league_tier_icon: string | null;
  exp_level: number | null;
  war_stars: number | null;
  attack_wins: number | null;
  war_preference: string | null;
  capital_contributions: number | null;
}

const SNAP_COLS =
  "member_tag, captured_at, donations, donations_received, trophies, town_hall, role, league_tier_id, league_tier_name, league_tier_icon, exp_level, war_stars, attack_wins, war_preference, capital_contributions";

export interface MemberOverviewRow {
  tag: string;
  name: string;
  role: string | null;
  townHall: number | null;
  donations: number | null;
  donationsReceived: number | null;
  trophies: number | null;
  ratio: number | null; // donations / donations_received
  donationsNegative: boolean; // cuenta negativo (leeching) según la regla
  donationsDelta: number | null; // vs. captura anterior (null si no hay previa)
  hadChange: boolean | null; // ¿cambió donaciones o trofeos desde la captura previa?
  // Sistema de ligas nuevo + XP + enriquecimiento:
  leagueTierId: number | null; // rango real (creciente); clave de orden
  leagueTierName: string | null;
  leagueTierIcon: string | null;
  expLevel: number | null;
  warStars: number | null;
  attackWins: number | null;
  warPreference: string | null; // "in" | "out"
  capitalContributions: number | null;
  firstSeenAt: string | null; // alta (primera vez que apareció el tag)
  isNew: boolean; // entró de verdad hace poco (no en el arranque del tracking)
  mainTag: string | null; // si es cuenta secundaria: tag de su cuenta principal
  mainName: string | null; // nombre de la principal (para el badge)
  discordId: string | null; // cuenta de Discord vinculada
  discordUsername: string | null;
  activeWarns: number; // warns vigentes (para el badge y el escalado)
}

export interface DashboardData {
  clanName: string | null;
  clanLevel: number | null;
  clanDescription: string | null;
  clanBadgeUrl: string | null;
  clanWarLeague: string | null;
  clanPoints: number | null;
  clanRequiredTrophies: number | null;
  clanWarWins: number | null;
  clanWarWinStreak: number | null;
  latestCapture: string | null;
  previousCapture: string | null;
  members: MemberOverviewRow[];
}

// Evolución del clan en el tiempo: por cada captura (clan-wide, mismo
// captured_at) suma copas y estrellas de guerra y cuenta miembros. Sirve para
// las gráficas de evolución del clan en el Home.
export interface ClanTrendPoint {
  t: number; // ms
  members: number;
  trophies: number; // suma de copas del clan
  warStars: number; // suma de estrellas de guerra (monótono)
}

// Nombre del clan (para "Añakleta vs X" en guerra). Cacheado; cambia rara vez.
export async function getClanName(): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from("clans").select("name").limit(1).maybeSingle();
  return (data?.name as string | null) ?? null;
}

export async function getClanTrends(): Promise<ClanTrendPoint[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("member_snapshots")
    .select("captured_at, trophies, war_stars")
    .order("captured_at", { ascending: true })
    .limit(50000);

  const byTs = new Map<string, { trophies: number; stars: number; n: number }>();
  for (const r of data ?? []) {
    const ts = r.captured_at as string;
    const g = byTs.get(ts) ?? { trophies: 0, stars: 0, n: 0 };
    g.trophies += (r.trophies as number | null) ?? 0;
    g.stars += (r.war_stars as number | null) ?? 0;
    g.n += 1;
    byTs.set(ts, g);
  }

  return [...byTs.entries()].map(([ts, g]) => ({
    t: new Date(ts).getTime(),
    members: g.n,
    trophies: g.trophies,
    warStars: g.stars,
  }));
}

// Devuelve una vista de cada miembro activo con su última captura y el delta
// respecto a la anterior. Las capturas son clan-wide (mismo captured_at para
// todos), así que basta con localizar los dos timestamps más recientes.
// Sin caché a propósito: incluye el Discord vinculado (que el bot cambia por
// fuera) y otros campos editables. Lectura directa a Supabase para que las
// tarjetas y el Home reflejen siempre el estado real (páginas force-dynamic).
export async function getMembersOverview(): Promise<DashboardData> {
  const supabase = createServerClient();

  // Los dos captured_at más recientes (distintos).
  const { data: times } = await supabase
    .from("member_snapshots")
    .select("captured_at")
    .order("captured_at", { ascending: false })
    .limit(200);

  const distinct: string[] = [];
  for (const row of times ?? []) {
    const t = row.captured_at as string;
    if (!distinct.includes(t)) distinct.push(t);
    if (distinct.length === 2) break;
  }
  const [latest, previous] = distinct;

  // Snapshots de esas dos capturas.
  const snaps: SnapRow[] = latest
    ? (
        await supabase
          .from("member_snapshots")
          .select(SNAP_COLS)
          .in("captured_at", [latest, previous].filter(Boolean) as string[])
      ).data ?? []
    : [];

  const latestByTag = new Map<string, SnapRow>();
  const prevByTag = new Map<string, SnapRow>();
  for (const s of snaps) {
    if (s.captured_at === latest) latestByTag.set(s.member_tag, s);
    else if (s.captured_at === previous) prevByTag.set(s.member_tag, s);
  }

  // Miembros activos (siguen en el clan). select("*") por resiliencia (main_tag
  // puede no estar migrada aún).
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true);
  const nameByTag = new Map<string, string>(
    (members ?? []).map((m) => [m.tag as string, m.name as string]),
  );

  // Línea base del tracking: el alta más antigua. Todo lo que entró en el
  // arranque comparte esa fecha, así que solo es "nuevo" quien entró bastante
  // después (>12h) y dentro de los últimos 7 días.
  const now = Date.now();
  const firstSeens = (members ?? [])
    .map((m) => (m.first_seen_at ? new Date(m.first_seen_at as string).getTime() : null))
    .filter((t): t is number => t != null);
  const baseline = firstSeens.length ? Math.min(...firstSeens) : now;
  const NEW_MS = 7 * 86_400_000;
  const MARGIN_MS = 12 * 3_600_000;

  const warnCounts = await getActiveWarnCounts(); // warns vigentes por tag

  const rows: MemberOverviewRow[] = (members ?? []).map((m) => {
    const cur = latestByTag.get(m.tag as string);
    const prev = prevByTag.get(m.tag as string);
    const donations = (cur?.donations as number | undefined) ?? null;
    const received = (cur?.donations_received as number | undefined) ?? null;
    const trophies = (cur?.trophies as number | undefined) ?? null;

    let donationsDelta: number | null = null;
    let hadChange: boolean | null = null;
    if (cur && prev) {
      donationsDelta = (cur.donations ?? 0) - (prev.donations ?? 0);
      hadChange =
        cur.donations !== prev.donations || cur.trophies !== prev.trophies;
    }

    return {
      tag: m.tag as string,
      name: m.name as string,
      role: (m.role as string | null) ?? null,
      townHall: (cur?.town_hall as number | undefined) ?? (m.town_hall as number | null) ?? null,
      donations,
      donationsReceived: received,
      trophies,
      ratio: received && received > 0 ? donations! / received : null,
      donationsNegative: donationsNegative(donations, received),
      donationsDelta,
      hadChange,
      leagueTierId: cur?.league_tier_id ?? null,
      leagueTierName: cur?.league_tier_name ?? null,
      leagueTierIcon: cur?.league_tier_icon ?? null,
      expLevel: cur?.exp_level ?? null,
      warStars: cur?.war_stars ?? null,
      attackWins: cur?.attack_wins ?? null,
      warPreference: cur?.war_preference ?? null,
      capitalContributions: cur?.capital_contributions ?? null,
      firstSeenAt: (m.first_seen_at as string | null) ?? null,
      isNew: (() => {
        const fs = m.first_seen_at ? new Date(m.first_seen_at as string).getTime() : null;
        return fs != null && now - fs < NEW_MS && fs - baseline > MARGIN_MS;
      })(),
      mainTag: (m.main_tag as string | null) ?? null,
      mainName: m.main_tag ? (nameByTag.get(m.main_tag as string) ?? null) : null,
      discordId: (m.discord_id as string | null) ?? null,
      discordUsername: (m.discord_username as string | null) ?? null,
      activeWarns: warnCounts.get(m.tag as string) ?? 0,
    };
  });

  // Orden por defecto: rango real (leagueTier) desc, desempate por copas.
  rows.sort(
    (a, b) =>
      (b.leagueTierId ?? -1) - (a.leagueTierId ?? -1) ||
      (b.trophies ?? -1) - (a.trophies ?? -1),
  );

  // select("*") a propósito: así el Home no se rompe si aún no se ha corrido la
  // migración que añade las columnas nuevas (las lee como undefined -> null).
  const { data: clan } = await supabase.from("clans").select("*").limit(1).maybeSingle();

  return {
    clanName: (clan?.name as string | null) ?? null,
    clanLevel: (clan?.level as number | null) ?? null,
    clanDescription: (clan?.description as string | null) ?? null,
    clanBadgeUrl: (clan?.badge_url as string | null) ?? null,
    clanWarLeague: (clan?.war_league as string | null) ?? null,
    clanPoints: (clan?.clan_points as number | null) ?? null,
    clanRequiredTrophies: (clan?.required_trophies as number | null) ?? null,
    clanWarWins: (clan?.war_wins as number | null) ?? null,
    clanWarWinStreak: (clan?.war_win_streak as number | null) ?? null,
    latestCapture: latest ?? null,
    previousCapture: previous ?? null,
    members: rows,
  };
}
