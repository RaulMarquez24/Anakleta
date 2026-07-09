// Subconjunto de los campos de la API de CoC que usamos. No es exhaustivo:
// solo lo que consume el snapshot y el dashboard.

interface CocLeagueRef {
  id: number;
  name: string;
  iconUrls?: {
    small?: string;
    tiny?: string;
    medium?: string;
    large?: string;
  };
}

export interface CocClanMember {
  tag: string;
  name: string;
  role: "leader" | "coLeader" | "admin" | "member";
  townHallLevel: number;
  expLevel: number;
  trophies: number;
  builderBaseTrophies?: number;
  clanRank: number;
  previousClanRank: number;
  donations: number;
  donationsReceived: number;
  league?: CocLeagueRef; // liga "clásica" (mayormente Unranked ahora)
  leagueTier?: CocLeagueRef; // rango del sistema nuevo (Ranked): id creciente
}

export interface CocClan {
  tag: string;
  name: string;
  clanLevel: number;
  members: number;
  memberList: CocClanMember[];
  description?: string;
  badgeUrls?: { small?: string; medium?: string; large?: string };
  warLeague?: { id: number; name: string };
  clanPoints?: number;
  requiredTrophies?: number;
  warWins?: number;
  warTies?: number;
  warLosses?: number;
  warWinStreak?: number;
}

// Datos extra del endpoint /players/{tag} (enriquecimiento).
export interface CocPlayer {
  tag: string;
  warStars?: number;
  attackWins?: number;
  defenseWins?: number;
  warPreference?: "in" | "out";
  clanCapitalContributions?: number;
}
