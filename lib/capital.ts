import type { SupabaseClient } from "@supabase/supabase-js";
import { cocFetch, encodeTag } from "@/lib/coc";
import { createServerClient } from "@/lib/supabase/server";
import { parseCocTime } from "@/lib/war";

// --- API: /clans/{tag}/capitalraidseasons ---
interface CocRaidMember {
  tag: string;
  name: string;
  attacks?: number;
  attackLimit?: number;
  bonusAttackLimit?: number;
  capitalResourcesLooted?: number;
}
interface CocRaidSeason {
  state?: string;
  startTime?: string;
  endTime?: string;
  capitalTotalLoot?: number;
  members?: CocRaidMember[];
}
interface CocRaidSeasons {
  items?: CocRaidSeason[];
}

// Captura los últimos asaltos de capital (fines de semana). Idempotente: upsert
// por start_time y reescribe los participantes. Resiliente arriba.
export async function captureCapitalRaids(
  supabase: SupabaseClient,
  clanTag = process.env.COC_CLAN_TAG ?? "",
): Promise<number> {
  let raw: CocRaidSeasons;
  try {
    raw = await cocFetch<CocRaidSeasons>(
      `/clans/${encodeTag(clanTag)}/capitalraidseasons?limit=6`,
    );
  } catch {
    return 0;
  }
  let saved = 0;
  for (const s of raw.items ?? []) {
    const startTime = parseCocTime(s.startTime);
    if (!startTime) continue;
    const { data: row, error } = await supabase
      .from("capital_raids")
      .upsert(
        {
          start_time: startTime,
          end_time: parseCocTime(s.endTime),
          state: s.state ?? null,
          total_loot: s.capitalTotalLoot ?? null,
          captured_at: new Date().toISOString(),
        },
        { onConflict: "start_time" },
      )
      .select("id")
      .single();
    if (error || !row) continue;
    const raidId = row.id as number;

    // La API solo devuelve `members` del asalto más reciente; en los findes
    // pasados llega vacío. Por eso SOLO se reescribe cuando hay lista: si no,
    // se conserva lo que ya se guardó (antes se borraba y se perdía el dato).
    const members = s.members ?? [];
    if (members.length > 0) {
      await supabase.from("capital_raid_members").delete().eq("raid_id", raidId);
      await supabase.from("capital_raid_members").insert(
        members.map((m) => ({
          raid_id: raidId,
          tag: m.tag,
          name: m.name,
          attacks: m.attacks ?? 0,
          attack_limit: m.attackLimit ?? 0,
          bonus_limit: m.bonusAttackLimit ?? 0,
          looted: m.capitalResourcesLooted ?? 0,
        })),
      );
    }
    saved++;
  }
  return saved;
}

// --- Lectura ---
export interface CapitalWeekend {
  startTime: string | null;
  endTime: string | null;
  attacks: number | null; // null = no participó
  possible: number; // tope de ataques (limit + bonus, normalmente 6)
  looted: number | null;
}

// Participación de UN miembro en los últimos asaltos: cada finde con sus ataques
// (o null si no participó, siempre que el finde sea posterior a su alta).
export async function getMemberCapital(
  tag: string,
  memberSinceMs: number | null = null,
  limit = 6,
): Promise<CapitalWeekend[]> {
  const supabase = createServerClient();
  const { data: raids } = await supabase
    .from("capital_raids")
    .select("id, start_time, end_time")
    .order("start_time", { ascending: false })
    .limit(limit);
  if (!raids || raids.length === 0) return [];

  const ids = raids.map((r) => r.id as number);
  const [{ data: mine }, { data: any_ }] = await Promise.all([
    supabase
      .from("capital_raid_members")
      .select("raid_id, attacks, attack_limit, bonus_limit, looted")
      .eq("tag", tag)
      .in("raid_id", ids),
    // Findes de los que tenemos lista de participantes (la API no la da de los
    // asaltos pasados; sin ella no se puede afirmar que alguien no participara).
    supabase.from("capital_raid_members").select("raid_id").in("raid_id", ids).limit(50000),
  ]);
  const byRaid = new Map<number, Record<string, unknown>>();
  for (const m of mine ?? []) byRaid.set(m.raid_id as number, m);
  const raidsWithData = new Set((any_ ?? []).map((r) => r.raid_id as number));

  const out: CapitalWeekend[] = [];
  for (const r of raids) {
    const endMs = r.end_time ? new Date(r.end_time as string).getTime() : null;
    // Si el finde acabó antes de que el jugador entrara al clan, no lo contamos.
    if (memberSinceMs != null && endMs != null && endMs < memberSinceMs) continue;
    // Sin datos de participación de ese finde: no se cuenta (ni a favor ni en contra).
    if (!raidsWithData.has(r.id as number)) continue;
    const row = byRaid.get(r.id as number);
    const possible =
      ((row?.attack_limit as number | null) ?? 5) + ((row?.bonus_limit as number | null) ?? 1);
    out.push({
      startTime: (r.start_time as string | null) ?? null,
      endTime: (r.end_time as string | null) ?? null,
      attacks: row ? ((row.attacks as number | null) ?? 0) : null,
      possible: row ? possible : 6,
      looted: row ? ((row.looted as number | null) ?? 0) : null,
    });
  }
  return out;
}

// Resumen agregado de capital de un miembro (para el resumen por jugador).
export interface CapitalSummary {
  weekends: number; // findes registrados (desde su alta)
  participated: number; // findes en los que atacó
  attacksUsed: number;
  attacksPossible: number;
  looted: number;
}
export function summarizeCapital(weeks: CapitalWeekend[]): CapitalSummary {
  let participated = 0,
    attacksUsed = 0,
    attacksPossible = 0,
    looted = 0;
  for (const w of weeks) {
    attacksPossible += w.possible;
    if (w.attacks != null) {
      participated++;
      attacksUsed += w.attacks;
      looted += w.looted ?? 0;
    }
  }
  return { weekends: weeks.length, participated, attacksUsed, attacksPossible, looted };
}
