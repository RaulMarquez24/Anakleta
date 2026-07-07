import { cocFetch, encodeTag, CocApiError } from "@/lib/coc";

// --- Tipos del subset de /currentwar que usamos ---
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
  tag: string;
  name: string;
  clanLevel: number;
  attacks: number;
  stars: number;
  destructionPercentage: number;
  members?: CocWarMember[];
}
interface CocCurrentWar {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  teamSize?: number;
  attacksPerMember?: number;
  preparationStartTime?: string;
  startTime?: string;
  endTime?: string;
  clan?: CocWarSide;
  opponent?: CocWarSide;
}

// --- Estructura normalizada para la vista ---
export interface WarMemberRow {
  tag: string;
  name: string;
  townHall: number;
  mapPosition: number;
  attacksUsed: number;
  attacksPending: number;
}
export interface WarView {
  state: CocCurrentWar["state"];
  isPrivate: boolean; // el currentwar está en privado (403)
  teamSize: number | null;
  attacksPerMember: number;
  opponentName: string | null;
  clanStars: number | null;
  opponentStars: number | null;
  clanDestruction: number | null;
  opponentDestruction: number | null;
  startTime: string | null; // ISO
  endTime: string | null; // ISO
  members: WarMemberRow[]; // ordenados por mapPosition
  pending: WarMemberRow[]; // solo los que tienen ataques pendientes
}

/** Parsea el formato de fecha compacto de CoC ("20260707T194500.000Z") a ISO. */
export function parseCocTime(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

export async function getCurrentWar(
  clanTag = process.env.COC_CLAN_TAG ?? "",
): Promise<WarView> {
  let raw: CocCurrentWar;
  try {
    raw = await cocFetch<CocCurrentWar>(
      `/clans/${encodeTag(clanTag)}/currentwar`,
    );
  } catch (err) {
    // Un clan con el registro de guerra en privado devuelve 403 aquí.
    if (err instanceof CocApiError && err.status === 403) {
      return emptyWar("notInWar", true);
    }
    throw err;
  }

  if (raw.state === "notInWar") return emptyWar("notInWar", false);

  const attacksPerMember = raw.attacksPerMember ?? 2; // guerra normal = 2
  const members: WarMemberRow[] = (raw.clan?.members ?? [])
    .map((m) => {
      const used = m.attacks?.length ?? 0;
      return {
        tag: m.tag,
        name: m.name,
        townHall: m.townhallLevel,
        mapPosition: m.mapPosition,
        attacksUsed: used,
        attacksPending: Math.max(0, attacksPerMember - used),
      };
    })
    .sort((a, b) => a.mapPosition - b.mapPosition);

  return {
    state: raw.state,
    isPrivate: false,
    teamSize: raw.teamSize ?? null,
    attacksPerMember,
    opponentName: raw.opponent?.name ?? null,
    clanStars: raw.clan?.stars ?? null,
    opponentStars: raw.opponent?.stars ?? null,
    clanDestruction: raw.clan?.destructionPercentage ?? null,
    opponentDestruction: raw.opponent?.destructionPercentage ?? null,
    startTime: parseCocTime(raw.startTime),
    endTime: parseCocTime(raw.endTime),
    members,
    pending: members.filter((m) => m.attacksPending > 0),
  };
}

function emptyWar(state: CocCurrentWar["state"], isPrivate: boolean): WarView {
  return {
    state,
    isPrivate,
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
export function buildWarNotice(war: WarView): string {
  if (war.state !== "inWar" || war.pending.length === 0) return "";
  const lines = war.pending.map(
    (m) =>
      `• ${m.name} — ${m.attacksPending} ataque${m.attacksPending > 1 ? "s" : ""}`,
  );
  const total = war.pending.reduce((n, m) => n + m.attacksPending, 0);
  return [
    `⚔️ AVISO DE GUERRA vs ${war.opponentName ?? "rival"}`,
    `Quedan ${total} ataques pendientes:`,
    ...lines,
    ``,
    `¡A por ellos! 💪`,
  ].join("\n");
}
