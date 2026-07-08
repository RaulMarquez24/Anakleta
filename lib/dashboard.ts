import { createServerClient } from "@/lib/supabase/server";

interface SnapRow {
  member_tag: string;
  captured_at: string;
  donations: number | null;
  donations_received: number | null;
  trophies: number | null;
  clan_rank: number | null;
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
  "member_tag, captured_at, donations, donations_received, trophies, clan_rank, town_hall, role, league_tier_id, league_tier_name, league_tier_icon, exp_level, war_stars, attack_wins, war_preference, capital_contributions";

export interface MemberOverviewRow {
  tag: string;
  name: string;
  role: string | null;
  townHall: number | null;
  clanRank: number | null;
  donations: number | null;
  donationsReceived: number | null;
  trophies: number | null;
  ratio: number | null; // donations / donations_received
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
}

export interface DashboardData {
  clanName: string | null;
  clanLevel: number | null;
  latestCapture: string | null;
  previousCapture: string | null;
  members: MemberOverviewRow[];
}

// Devuelve una vista de cada miembro activo con su última captura y el delta
// respecto a la anterior. Las capturas son clan-wide (mismo captured_at para
// todos), así que basta con localizar los dos timestamps más recientes.
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

  // Miembros activos (siguen en el clan).
  const { data: members } = await supabase
    .from("members")
    .select("tag, name, role, town_hall, is_active")
    .eq("is_active", true);

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
      clanRank: (cur?.clan_rank as number | undefined) ?? null,
      donations,
      donationsReceived: received,
      trophies,
      ratio: received && received > 0 ? donations! / received : null,
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
    };
  });

  // Orden por defecto: rango real (leagueTier) desc, desempate por copas.
  rows.sort(
    (a, b) =>
      (b.leagueTierId ?? -1) - (a.leagueTierId ?? -1) ||
      (b.trophies ?? -1) - (a.trophies ?? -1),
  );

  const { data: clan } = await supabase
    .from("clans")
    .select("name, level")
    .limit(1)
    .maybeSingle();

  return {
    clanName: (clan?.name as string | null) ?? null,
    clanLevel: (clan?.level as number | null) ?? null,
    latestCapture: latest ?? null,
    previousCapture: previous ?? null,
    members: rows,
  };
}
