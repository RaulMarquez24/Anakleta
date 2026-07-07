// Subconjunto de los campos de la API de CoC que usamos. No es exhaustivo:
// solo lo que consume el snapshot y el dashboard.

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
  league?: { id: number; name: string };
}

export interface CocClan {
  tag: string;
  name: string;
  clanLevel: number;
  members: number;
  memberList: CocClanMember[];
}
