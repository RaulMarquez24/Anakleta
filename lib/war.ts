import { cocFetch, encodeTag, CocApiError } from "@/lib/coc";

// --- Tipos del subset de guerra que usamos (vale para /currentwar y CWL) ---
interface CocWarAttack {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
}
interface CocWarMember {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  attacks?: CocWarAttack[];
}
interface CocWarSide {
  tag?: string;
  name: string;
  stars?: number;
  destructionPercentage?: number;
  members?: CocWarMember[];
}
export interface CocCurrentWar {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  teamSize?: number;
  attacksPerMember?: number;
  startTime?: string;
  endTime?: string;
  clan?: CocWarSide;
  opponent?: CocWarSide;
}
interface CocLeagueGroup {
  state?: string;
  season?: string;
  clans?: { tag: string; name: string }[];
  rounds?: { warTags: string[] }[];
}

// --- Estructura normalizada para la vista ---
export interface WarMemberRow {
  tag: string;
  name: string;
  townHall: number;
  mapPosition: number;
  attacksUsed: number;
  attacksPending: number;
  stars: number; // estrellas conseguidas (suma de sus ataques)
  destruction: number; // % sumado de sus ataques
}
export interface WarView {
  state: CocCurrentWar["state"];
  isPrivate: boolean;
  isCwl: boolean; // guerra de Liga de Clanes (CWL)
  round: number | null; // ronda de CWL (1-7)
  teamSize: number | null;
  attacksPerMember: number;
  opponentName: string | null;
  clanStars: number | null;
  opponentStars: number | null;
  clanDestruction: number | null;
  opponentDestruction: number | null;
  startTime: string | null;
  endTime: string | null;
  members: WarMemberRow[];
  pending: WarMemberRow[];
}

/** Parsea el formato de fecha compacto de CoC ("20260707T194500.000Z") a ISO. */
export function parseCocTime(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

function tagEq(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.replace(/^#/, "").toUpperCase() === b.replace(/^#/, "").toUpperCase();
}

async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

// Construye la vista normalizada. En CWL nuestro clan puede venir como clan u
// opponent, así que elegimos "nosotros" por el tag.
function buildView(
  raw: CocCurrentWar,
  opts: { isCwl: boolean; round: number | null; clanTag: string },
): WarView {
  const usIsClan = !opts.isCwl || tagEq(raw.clan?.tag, opts.clanTag);
  const us = usIsClan ? raw.clan : raw.opponent;
  const them = usIsClan ? raw.opponent : raw.clan;
  const attacksPerMember = raw.attacksPerMember ?? (opts.isCwl ? 1 : 2);

  const members: WarMemberRow[] = (us?.members ?? [])
    .map((m) => {
      const atks = m.attacks ?? [];
      return {
        tag: m.tag,
        name: m.name,
        townHall: m.townhallLevel,
        mapPosition: m.mapPosition,
        attacksUsed: atks.length,
        attacksPending: Math.max(0, attacksPerMember - atks.length),
        stars: atks.reduce((n, a) => n + (a.stars ?? 0), 0),
        destruction: atks.reduce((n, a) => n + (a.destructionPercentage ?? 0), 0),
      };
    })
    .sort((a, b) => a.mapPosition - b.mapPosition);

  return {
    state: raw.state,
    isPrivate: false,
    isCwl: opts.isCwl,
    round: opts.round,
    teamSize: raw.teamSize ?? null,
    attacksPerMember,
    opponentName: them?.name ?? null,
    clanStars: us?.stars ?? null,
    opponentStars: them?.stars ?? null,
    clanDestruction: us?.destructionPercentage ?? null,
    opponentDestruction: them?.destructionPercentage ?? null,
    startTime: parseCocTime(raw.startTime),
    endTime: parseCocTime(raw.endTime),
    members,
    pending: members.filter((m) => m.attacksPending > 0),
  };
}

function warPriority(state: string): number {
  return state === "inWar" ? 3 : state === "preparation" ? 2 : state === "warEnded" ? 1 : 0;
}

// Rondas de CWL con warTags reales (descarta #0 = no empezada) + temporada.
async function fetchLeagueGroup(
  clanTag: string,
): Promise<{ season: string | null; refs: { round: number; tag: string }[] }> {
  let group: CocLeagueGroup;
  try {
    group = await cocFetch<CocLeagueGroup>(`/clans/${encodeTag(clanTag)}/currentwar/leaguegroup`);
  } catch (err) {
    if (err instanceof CocApiError && (err.status === 404 || err.status === 403))
      return { season: null, refs: [] };
    throw err;
  }
  const refs = (group.rounds ?? []).flatMap((r, i) =>
    (r.warTags ?? []).filter((t) => t && t !== "#0").map((tag) => ({ round: i + 1, tag })),
  );
  return { season: group.season ?? null, refs };
}

async function fetchWars(
  refs: { round: number; tag: string }[],
  clanTag: string,
): Promise<{ round: number; raw: CocCurrentWar }[]> {
  const results = await mapPool(refs, 6, async (r) => {
    try {
      const raw = await cocFetch<CocCurrentWar>(`/clanwarleagues/wars/${encodeTag(r.tag)}`);
      return { round: r.round, raw };
    } catch {
      return null;
    }
  });
  return results.filter(
    (x): x is { round: number; raw: CocCurrentWar } =>
      x != null && (tagEq(x.raw.clan?.tag, clanTag) || tagEq(x.raw.opponent?.tag, clanTag)),
  );
}

// Guerra CWL "actual" de nuestro clan: mira las 2 últimas rondas con datos y
// elige la que esté en guerra (o la más reciente en preparación/terminada).
async function getCurrentCwlWar(clanTag: string): Promise<WarView | null> {
  const { refs } = await fetchLeagueGroup(clanTag);
  if (!refs.length) return null;
  const maxRound = Math.max(...refs.map((r) => r.round));
  const subset = refs.filter((r) => r.round >= maxRound - 1); // últimas 2 rondas
  const ours = await fetchWars(subset, clanTag);
  if (!ours.length) return null;
  ours.sort(
    (a, b) =>
      warPriority(b.raw.state) - warPriority(a.raw.state) ||
      new Date(b.raw.startTime ?? 0).getTime() - new Date(a.raw.startTime ?? 0).getTime(),
  );
  const chosen = ours[0];
  return buildView(chosen.raw, { isCwl: true, round: chosen.round, clanTag });
}

export async function getCurrentWar(
  clanTag = process.env.COC_CLAN_TAG ?? "",
): Promise<WarView> {
  let raw: CocCurrentWar | null = null;
  let wasPrivate = false;
  try {
    raw = await cocFetch<CocCurrentWar>(`/clans/${encodeTag(clanTag)}/currentwar`);
  } catch (err) {
    if (err instanceof CocApiError && err.status === 403) wasPrivate = true;
    else throw err;
  }

  // Guerra normal en curso.
  if (raw && raw.state !== "notInWar") {
    return buildView(raw, { isCwl: false, round: null, clanTag });
  }

  // Si no hay guerra normal, probar CWL.
  const cwl = await getCurrentCwlWar(clanTag).catch(() => null);
  if (cwl) return cwl;

  return emptyWar("notInWar", wasPrivate);
}

// --- Captura de participación en guerra (para el histórico) ---
export interface WarMemberRecord {
  tag: string;
  name: string;
  mapPosition: number;
  townHall: number;
  attacksUsed: number;
  stars: number; // estrellas conseguidas (suma de sus ataques)
  destruction: number; // % sumado de sus ataques
}
export interface WarRecord {
  warTag: string; // clave única (warTag real en CWL, sintético en guerra normal)
  isCwl: boolean;
  season: string | null;
  round: number | null;
  state: string;
  teamSize: number | null;
  opponentName: string | null;
  clanStars: number | null;
  opponentStars: number | null;
  clanDestruction: number | null;
  opponentDestruction: number | null;
  startTime: string | null;
  endTime: string | null;
  result: string | null;
  attacks: { attackerTag: string; defenderTag: string; stars: number; destruction: number; order: number }[];
  members: WarMemberRecord[]; // alineación de nuestro clan
}

function toRecord(
  raw: CocCurrentWar,
  opts: { warTag: string; isCwl: boolean; clanTag: string; season: string | null; round: number | null },
): WarRecord {
  const usIsClan = !opts.isCwl || tagEq(raw.clan?.tag, opts.clanTag);
  const us = usIsClan ? raw.clan : raw.opponent;
  const them = usIsClan ? raw.opponent : raw.clan;
  let result: string | null = null;
  if (raw.state === "warEnded" && us && them) {
    const cs = us.stars ?? 0;
    const os = them.stars ?? 0;
    const cd = us.destructionPercentage ?? 0;
    const od = them.destructionPercentage ?? 0;
    result = cs > os ? "win" : cs < os ? "lose" : cd > od ? "win" : cd < od ? "lose" : "tie";
  }
  const attacks = (us?.members ?? []).flatMap((m) =>
    (m.attacks ?? []).map((a) => ({
      attackerTag: a.attackerTag,
      defenderTag: a.defenderTag,
      stars: a.stars,
      destruction: a.destructionPercentage,
      order: a.order,
    })),
  );
  const members: WarMemberRecord[] = (us?.members ?? []).map((m) => {
    const atks = m.attacks ?? [];
    return {
      tag: m.tag,
      name: m.name,
      mapPosition: m.mapPosition,
      townHall: m.townhallLevel,
      attacksUsed: atks.length,
      stars: atks.reduce((n, a) => n + (a.stars ?? 0), 0),
      destruction: atks.reduce((n, a) => n + (a.destructionPercentage ?? 0), 0),
    };
  });
  return {
    warTag: opts.warTag,
    isCwl: opts.isCwl,
    season: opts.season,
    round: opts.round,
    state: raw.state,
    teamSize: raw.teamSize ?? null,
    opponentName: them?.name ?? null,
    clanStars: us?.stars ?? null,
    opponentStars: them?.stars ?? null,
    clanDestruction: us?.destructionPercentage ?? null,
    opponentDestruction: them?.destructionPercentage ?? null,
    startTime: parseCocTime(raw.startTime),
    endTime: parseCocTime(raw.endTime),
    result,
    attacks,
    members,
  };
}

// Devuelve las guerras a registrar: la normal si la hay, o TODAS nuestras
// guerras de CWL (una por ronda con datos).
export async function getWarRecords(
  clanTag = process.env.COC_CLAN_TAG ?? "",
): Promise<WarRecord[]> {
  let raw: CocCurrentWar | null = null;
  try {
    raw = await cocFetch<CocCurrentWar>(`/clans/${encodeTag(clanTag)}/currentwar`);
  } catch (err) {
    if (!(err instanceof CocApiError && err.status === 403)) throw err;
  }

  if (raw && (raw.state === "inWar" || raw.state === "warEnded")) {
    return [
      toRecord(raw, {
        warTag: `n-${raw.startTime ?? "?"}`,
        isCwl: false,
        clanTag,
        season: null,
        round: null,
      }),
    ];
  }

  // CWL: registrar todas nuestras guerras de todas las rondas con datos.
  const { season, refs } = await fetchLeagueGroup(clanTag);
  if (!refs.length) return [];
  const ours = await fetchWars(refs, clanTag);
  return ours
    .filter((x) => x.raw.state === "inWar" || x.raw.state === "warEnded")
    .map((x) =>
      toRecord(x.raw, {
        warTag: refs.find((r) => r.round === x.round)?.tag ?? `cwl-${season}-${x.round}`,
        isCwl: true,
        clanTag,
        season,
        round: x.round,
      }),
    );
}

function emptyWar(state: CocCurrentWar["state"], isPrivate: boolean): WarView {
  return {
    state,
    isPrivate,
    isCwl: false,
    round: null,
    teamSize: null,
    attacksPerMember: 2,
    opponentName: null,
    clanStars: null,
    opponentStars: null,
    clanDestruction: null,
    opponentDestruction: null,
    startTime: null,
    endTime: null,
    members: [],
    pending: [],
  };
}

/** Texto listo para copiar/pegar al chat del clan con los ataques pendientes. */
export function buildNoticeText(opts: {
  opponentName: string | null;
  isCwl: boolean;
  round: number | null;
  pending: { name: string; attacksPending: number }[];
}): string {
  if (opts.pending.length === 0) return "";
  const lines = opts.pending.map(
    (m) => `• ${m.name} — ${m.attacksPending} ataque${m.attacksPending > 1 ? "s" : ""}`,
  );
  const total = opts.pending.reduce((n, m) => n + m.attacksPending, 0);
  const titulo = opts.isCwl
    ? `⚔️ AVISO CWL${opts.round ? ` (Ronda ${opts.round})` : ""} vs ${opts.opponentName ?? "rival"}`
    : `⚔️ AVISO DE GUERRA vs ${opts.opponentName ?? "rival"}`;
  return [titulo, `Quedan ${total} ataques pendientes:`, ...lines, ``, `¡A por ellos! 💪`].join("\n");
}
