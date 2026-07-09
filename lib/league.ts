import { unstable_cache } from "next/cache";
import { cocFetch, encodeTag } from "@/lib/coc";

// Historial de ligas (ranked) de un jugador: /players/{tag}/leaguehistory.
// El ranked es SEMANAL; leagueSeasonId es el unix (segundos) del inicio de la
// semana. Bajo demanda (solo al ver la ficha), no en la captura de 6h.

interface RawLeagueSeason {
  leagueSeasonId?: number;
  leagueTrophies?: number;
  leagueTierId?: number;
  placement?: number;
  attackWins?: number;
  attackLosses?: number;
  attackStars?: number;
  defenseWins?: number;
  defenseLosses?: number;
  defenseStars?: number;
  maxBattles?: number;
}

export interface LeagueSeason {
  seasonId: number;
  weekStartMs: number; // inicio de la semana en ms
  trophies: number;
  placement: number | null;
  attackWins: number;
  attackLosses: number;
  attackStars: number;
  defenseWins: number;
  defenseLosses: number;
  defenseStars: number;
  maxBattles: number;
}

export const getLeagueHistory = unstable_cache(getLeagueHistoryImpl, ["league-history"], {
  revalidate: 3600, // el ranked es semanal; 1h de caché sobra
});

async function getLeagueHistoryImpl(tag: string): Promise<LeagueSeason[]> {
  let raw: { items?: RawLeagueSeason[] };
  try {
    raw = await cocFetch<{ items?: RawLeagueSeason[] }>(
      `/players/${encodeTag(tag)}/leaguehistory`,
    );
  } catch {
    return [];
  }
  const items = raw.items ?? [];
  return items
    .map((s) => ({
      seasonId: s.leagueSeasonId ?? 0,
      weekStartMs: (s.leagueSeasonId ?? 0) * 1000,
      trophies: s.leagueTrophies ?? 0,
      placement: s.placement ?? null,
      attackWins: s.attackWins ?? 0,
      attackLosses: s.attackLosses ?? 0,
      attackStars: s.attackStars ?? 0,
      defenseWins: s.defenseWins ?? 0,
      defenseLosses: s.defenseLosses ?? 0,
      defenseStars: s.defenseStars ?? 0,
      maxBattles: s.maxBattles ?? 0,
    }))
    .sort((a, b) => b.seasonId - a.seasonId); // más reciente primero
}
