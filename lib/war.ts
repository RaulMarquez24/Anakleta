import { unstable_cache } from "next/cache";
import { cocFetch, encodeTag, CocApiError } from "@/lib/coc";

// --- Tipos del subset de guerra que usamos (vale para /currentwar y CWL) ---
interface CocWarAttack {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
  duration?: number; // segundos que duró el ataque
}
interface CocWarMember {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  attacks?: CocWarAttack[];
  bestOpponentAttack?: { stars: number; destructionPercentage: number };
}
interface CocWarSide {
  tag?: string;
  name: string;
  clanLevel?: number;
  badgeUrls?: { small?: string; medium?: string; large?: string };
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
// Detalle de un ataque concreto: a quién le pegó, cuánto duró y si respetó el
// espejo (misma posición que la suya en el mapa).
// Clasificación del objetivo respecto al espejo:
//  - "mirror": atacó su propia posición (su espejo).
//  - "cleanup": atacó otra base pero YA estaba atacada (remate/limpieza, ok).
//  - "stolen": atacó una base fresca que no era la suya (le robó el espejo a
//    otro compañero, el que tiene esa posición).
export type MirrorStatus = "mirror" | "cleanup" | "stolen";
export interface AttackView {
  stars: number;
  destruction: number;
  order: number; // orden global del ataque en la guerra
  duration: number | null; // segundos
  defenderName: string | null;
  defenderPosition: number | null;
  defenderTh: number | null;
  isMirror: boolean; // atacó a su espejo (misma posición)
  mirrorStatus: MirrorStatus | null; // null si no hay datos (guerra antigua)
  stolenFrom: string | null; // a quién le robó el espejo (si "stolen")
}
export interface WarMemberRow {
  tag: string;
  name: string;
  townHall: number;
  mapPosition: number;
  attacksUsed: number;
  attacksPending: number;
  stars: number; // estrellas conseguidas (suma de sus ataques)
  destruction: number; // % sumado de sus ataques
  attacks: AttackView[]; // sus ataques (destino, duración, espejo)
  // Guerra normal: el 2º ataque es AYUDA. reachableHelp = le queda 2º, la guerra
  // no está rematada y hay una base sin 3⭐ a su alcance (TH ≤ el suyo + 1).
  reachableHelp: boolean;
}
// Base rival (para inspeccionar al enemigo): posición, TH y estrellas que YA le
// hemos hecho (su mejor defensa recibida) para saber a quién queda por rematar.
export interface OpponentMemberRow {
  tag: string;
  name: string;
  townHall: number;
  mapPosition: number;
  starsTaken: number; // estrellas que le hemos hecho
  destructionTaken: number;
}
export interface WarView {
  state: CocCurrentWar["state"];
  isPrivate: boolean;
  isCwl: boolean; // guerra de Liga de Clanes (CWL)
  round: number | null; // ronda de CWL (1-7)
  teamSize: number | null;
  attacksPerMember: number;
  warCompleted: boolean; // todas las bases rivales al 3⭐ (no hace falta rematar)
  opponentName: string | null;
  opponentTag: string | null;
  opponentLevel: number | null;
  opponentBadgeUrl: string | null;
  clanStars: number | null;
  opponentStars: number | null;
  clanDestruction: number | null;
  opponentDestruction: number | null;
  startTime: string | null;
  endTime: string | null;
  members: WarMemberRow[];
  pending: WarMemberRow[];
  opponentMembers: OpponentMemberRow[];
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

// Índice de bases rivales por tag, para resolver a quién se atacó.
function opponentByTag(them?: CocWarSide): Map<string, CocWarMember> {
  const map = new Map<string, CocWarMember>();
  for (const o of them?.members ?? []) map.set(o.tag, o);
  return map;
}

// Detalle de un ataque: objetivo (nombre/posición/TH), duración y espejo.
function attackView(
  a: CocWarAttack,
  attacker: CocWarMember,
  oppByTag: Map<string, CocWarMember>,
): AttackView {
  const d = oppByTag.get(a.defenderTag);
  const defenderPosition = d?.mapPosition ?? null;
  return {
    stars: a.stars ?? 0,
    destruction: a.destructionPercentage ?? 0,
    order: a.order ?? 0,
    duration: a.duration ?? null,
    defenderName: d?.name ?? null,
    defenderPosition,
    defenderTh: d?.townhallLevel ?? null,
    isMirror: defenderPosition != null && defenderPosition === attacker.mapPosition,
    mirrorStatus: null, // lo fija classifyMirror() con el contexto de la guerra
    stolenFrom: null,
  };
}

// Clasifica cada ataque en espejo / remate / robó espejo, usando el orden global
// de TODOS los ataques (para saber si la base ya estaba tocada) y las posiciones
// de nuestros miembros (para saber a quién pertenecía el espejo robado).
function classifyMirror(
  attacks: { defenderTag: string; order: number }[],
  nameByPosition: Map<number, string>,
) {
  const firstOrderByDefender = new Map<string, number>();
  for (const a of attacks) {
    const prev = firstOrderByDefender.get(a.defenderTag);
    if (prev == null || a.order < prev) firstOrderByDefender.set(a.defenderTag, a.order);
  }
  return (a: AttackView, defenderTag: string): void => {
    if (a.defenderPosition == null) return; // sin datos: se deja null
    if (a.isMirror) {
      a.mirrorStatus = "mirror";
      return;
    }
    const firstOnBase = firstOrderByDefender.get(defenderTag) === a.order;
    if (firstOnBase) {
      a.mirrorStatus = "stolen";
      a.stolenFrom = nameByPosition.get(a.defenderPosition) ?? null;
    } else {
      a.mirrorStatus = "cleanup";
    }
  };
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

  // Bases rivales que aún no están al 3⭐ (para el 2º ataque = ayuda).
  const remainingThs = (them?.members ?? [])
    .filter((m) => (m.bestOpponentAttack?.stars ?? 0) < 3)
    .map((m) => m.townhallLevel);
  const warCompleted = remainingThs.length === 0;

  const oppByTag = opponentByTag(them);
  // Contexto para clasificar espejo/remate/robo: todos los ataques + nuestras
  // posiciones (para nombrar a quién se le robó el espejo).
  const allAttacks = (us?.members ?? []).flatMap((m) =>
    (m.attacks ?? []).map((a) => ({ defenderTag: a.defenderTag, order: a.order ?? 0 })),
  );
  const nameByPosition = new Map<number, string>();
  for (const m of us?.members ?? []) nameByPosition.set(m.mapPosition, m.name);
  const classify = classifyMirror(allAttacks, nameByPosition);

  const members: WarMemberRow[] = (us?.members ?? [])
    .map((m) => {
      const atks = m.attacks ?? [];
      const attacksUsed = atks.length;
      const attacksPending = Math.max(0, attacksPerMember - attacksUsed);
      // Ayuda con el 2º: solo guerra normal, hizo ya el 1º, la guerra no está
      // rematada y hay base a su alcance (TH ≤ el suyo + 1; se puede intentar uno arriba).
      const reachableHelp =
        !opts.isCwl &&
        !warCompleted &&
        attacksUsed >= 1 &&
        attacksPending > 0 &&
        remainingThs.some((th) => th <= m.townhallLevel + 1);
      return {
        tag: m.tag,
        name: m.name,
        townHall: m.townhallLevel,
        mapPosition: m.mapPosition,
        attacksUsed,
        attacksPending,
        stars: atks.reduce((n, a) => n + (a.stars ?? 0), 0),
        destruction: atks.reduce((n, a) => n + (a.destructionPercentage ?? 0), 0),
        attacks: atks
          .map((a) => {
            const v = attackView(a, m, oppByTag);
            classify(v, a.defenderTag);
            return v;
          })
          .sort((a, b) => a.order - b.order),
        reachableHelp,
      };
    })
    .sort((a, b) => a.mapPosition - b.mapPosition);

  const opponentMembers: OpponentMemberRow[] = (them?.members ?? [])
    .map((m) => ({
      tag: m.tag,
      name: m.name,
      townHall: m.townhallLevel,
      mapPosition: m.mapPosition,
      starsTaken: m.bestOpponentAttack?.stars ?? 0,
      destructionTaken: m.bestOpponentAttack?.destructionPercentage ?? 0,
    }))
    .sort((a, b) => a.mapPosition - b.mapPosition);

  return {
    state: raw.state,
    isPrivate: false,
    isCwl: opts.isCwl,
    round: opts.round,
    teamSize: raw.teamSize ?? null,
    attacksPerMember,
    warCompleted,
    opponentName: them?.name ?? null,
    opponentTag: them?.tag ?? null,
    opponentLevel: them?.clanLevel ?? null,
    opponentBadgeUrl: them?.badgeUrls?.medium ?? them?.badgeUrls?.small ?? null,
    clanStars: us?.stars ?? null,
    opponentStars: them?.stars ?? null,
    clanDestruction: us?.destructionPercentage ?? null,
    opponentDestruction: them?.destructionPercentage ?? null,
    startTime: parseCocTime(raw.startTime),
    endTime: parseCocTime(raw.endTime),
    members,
    pending: members.filter((m) => m.attacksPending > 0),
    opponentMembers,
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

// Estado de la CWL de nuestro clan según el leaguegroup: temporada (YYYY-MM) y
// fase. La usa el cron para detectar cuándo arranca (cerrar inscripción
// individual) y cuándo termina (retirar el rol). Sin grupo activo -> season null.
export async function getCwlSeasonState(
  clanTag = process.env.COC_CLAN_TAG ?? "",
): Promise<{ season: string | null; state: string | null; active: boolean }> {
  if (!clanTag) return { season: null, state: null, active: false };
  try {
    const group = await cocFetch<CocLeagueGroup>(
      `/clans/${encodeTag(clanTag)}/currentwar/leaguegroup`,
    );
    const state = group.state ?? null; // notInWar | preparation | inWar | ended
    const active = state === "preparation" || state === "inWar";
    return { season: group.season ?? null, state, active };
  } catch (err) {
    if (err instanceof CocApiError && (err.status === 404 || err.status === 403)) {
      return { season: null, state: null, active: false };
    }
    throw err;
  }
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

export const getCurrentWar = unstable_cache(getCurrentWarImpl, ["current-war"], {
  revalidate: 120,
});

// Igual que getCurrentWar pero SIN caché: al consultar una guerra concreta hay
// que ver lo que devuelve Clash en ese instante (nada de esperar a una captura).
export function getCurrentWarFresh(clanTag?: string): Promise<WarView> {
  return getCurrentWarImpl(clanTag);
}

async function getCurrentWarImpl(
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
  attacks: {
    attackerTag: string;
    defenderTag: string;
    stars: number;
    destruction: number;
    order: number;
    duration: number | null;
    defenderName: string | null;
    defenderPosition: number | null;
    defenderTh: number | null;
    attackerPosition: number | null;
    isMirror: boolean;
  }[];
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
  const oppByTag = opponentByTag(them);
  const attacks = (us?.members ?? []).flatMap((m) =>
    (m.attacks ?? []).map((a) => {
      const v = attackView(a, m, oppByTag);
      return {
        attackerTag: a.attackerTag,
        defenderTag: a.defenderTag,
        stars: a.stars,
        destruction: a.destructionPercentage,
        order: a.order,
        duration: v.duration,
        defenderName: v.defenderName,
        defenderPosition: v.defenderPosition,
        defenderTh: v.defenderTh,
        attackerPosition: m.mapPosition ?? null,
        isMirror: v.isMirror,
      };
    }),
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
// `finalizedTags`: warTags de CWL ya guardados como terminados. Se saltan (no se
// vuelven a descargar ni reescribir: una ronda cerrada ya no cambia).
export async function getWarRecords(
  clanTag = process.env.COC_CLAN_TAG ?? "",
  finalizedTags: Set<string> = new Set(),
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

  // Nota: la reconciliación con el warlog (resultado/estrellas finales oficiales
  // de guerras normales ya cerradas) vive en getWarLog() + finalizeEndedWars().

  // CWL: registrar nuestras guerras de las rondas con datos, saltando las que ya
  // están guardadas como terminadas (no cambian; ahorra ~decenas de llamadas).
  const { season, refs } = await fetchLeagueGroup(clanTag);
  const pending = refs.filter((r) => !finalizedTags.has(r.tag));
  if (!pending.length) return [];
  const ours = await fetchWars(pending, clanTag);
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

// ── Warlog: resultado FINAL oficial de guerras normales ya cerradas ──────────
// El /currentwar deja de reportar la guerra en cuanto empieza la preparación de
// la siguiente, así que una guerra capturada a mitad puede quedarse sin datos
// finales. El warlog público guarda el marcador definitivo de las últimas
// guerras (solo resumen: estrellas y % del clan y del rival, sin ataques).
export interface WarLogEntry {
  result: "win" | "lose" | "tie" | null;
  endTime: string | null; // ISO
  teamSize: number | null;
  clanStars: number | null;
  opponentStars: number | null;
  clanDestruction: number | null;
  opponentDestruction: number | null;
  opponentName: string | null;
}

interface CocWarLogRaw {
  items?: Array<{
    result?: string | null;
    endTime?: string;
    teamSize?: number;
    clan?: { stars?: number; destructionPercentage?: number };
    opponent?: { name?: string; tag?: string; stars?: number; destructionPercentage?: number };
  }>;
}

// Devuelve las guerras normales del warlog (excluye rondas de CWL, que salen con
// result=null y opponent.tag="#0"). [] si el warlog es privado o falla.
export async function getWarLog(
  clanTag = process.env.COC_CLAN_TAG ?? "",
): Promise<WarLogEntry[]> {
  let raw: CocWarLogRaw;
  try {
    raw = await cocFetch<CocWarLogRaw>(`/clans/${encodeTag(clanTag)}/warlog?limit=20`);
  } catch {
    return [];
  }
  return (raw.items ?? [])
    .filter((e) => e.result != null && e.opponent?.tag !== "#0")
    .map((e) => ({
      result: (e.result as WarLogEntry["result"]) ?? null,
      endTime: parseCocTime(e.endTime),
      teamSize: e.teamSize ?? null,
      clanStars: e.clan?.stars ?? null,
      opponentStars: e.opponent?.stars ?? null,
      clanDestruction: e.clan?.destructionPercentage ?? null,
      opponentDestruction: e.opponent?.destructionPercentage ?? null,
      opponentName: e.opponent?.name ?? null,
    }));
}

function emptyWar(state: CocCurrentWar["state"], isPrivate: boolean): WarView {
  return {
    state,
    isPrivate,
    isCwl: false,
    round: null,
    teamSize: null,
    attacksPerMember: 2,
    warCompleted: false,
    opponentName: null,
    opponentTag: null,
    opponentLevel: null,
    opponentBadgeUrl: null,
    clanStars: null,
    opponentStars: null,
    clanDestruction: null,
    opponentDestruction: null,
    startTime: null,
    endTime: null,
    members: [],
    pending: [],
    opponentMembers: [],
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
