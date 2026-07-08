import type { SupabaseClient } from "@supabase/supabase-js";
import { CocApiError, cocFetch, encodeTag } from "@/lib/coc";
import { parseCocTime } from "@/lib/war";

// Estructura cruda de /currentwar con detalle de ataques (para grabar historial).
interface RawAttack {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
}
interface RawSide {
  name?: string;
  stars?: number;
  destructionPercentage?: number;
  members?: { tag: string; attacks?: RawAttack[] }[];
}
interface RawWar {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  teamSize?: number;
  startTime?: string;
  endTime?: string;
  clan?: RawSide;
  opponent?: RawSide;
}

export interface WarCaptureResult {
  recorded: boolean;
  state?: string;
  attacks?: number;
  reason?: string;
}

// Graba la guerra actual (si la hay) en wars + war_attacks. Idempotente: usa una
// clave natural por guerra (warTag si existe, o start-time para guerra normal) y
// reescribe los ataques en cada captura, así la captura final (warEnded) queda
// completa. Se llama desde el snapshot; es resiliente (no tumba la captura).
export async function captureWar(
  supabase: SupabaseClient,
  capturedAt: string,
  clanTag = process.env.COC_CLAN_TAG ?? "",
): Promise<WarCaptureResult> {
  let war: RawWar;
  try {
    war = await cocFetch<RawWar>(`/clans/${encodeTag(clanTag)}/currentwar`);
  } catch (err) {
    if (err instanceof CocApiError && err.status === 403) {
      return { recorded: false, reason: "war log privado" };
    }
    throw err;
  }

  // Solo grabamos cuando hay ataques posibles (en guerra o terminada).
  if (war.state !== "inWar" && war.state !== "warEnded") {
    return { recorded: false, reason: war.state };
  }

  const warKey = `n-${war.startTime ?? "?"}`; // guerra normal: clave por inicio
  const startTime = parseCocTime(war.startTime);
  const endTime = parseCocTime(war.endTime);

  let result: string | null = null;
  if (war.state === "warEnded" && war.clan && war.opponent) {
    const cs = war.clan.stars ?? 0;
    const os = war.opponent.stars ?? 0;
    const cd = war.clan.destructionPercentage ?? 0;
    const od = war.opponent.destructionPercentage ?? 0;
    result = cs > os ? "win" : cs < os ? "lose" : cd > od ? "win" : cd < od ? "lose" : "tie";
  }

  const { data: warRow, error: warErr } = await supabase
    .from("wars")
    .upsert(
      {
        war_tag: warKey,
        state: war.state,
        team_size: war.teamSize ?? null,
        opponent_name: war.opponent?.name ?? null,
        start_time: startTime,
        end_time: endTime,
        result,
        captured_at: capturedAt,
      },
      { onConflict: "war_tag" },
    )
    .select("id")
    .single();
  if (warErr) throw warErr;
  const warId = warRow.id as number;

  // Reescribe los ataques de nuestros miembros para esta guerra.
  await supabase.from("war_attacks").delete().eq("war_id", warId);
  const attacks = (war.clan?.members ?? []).flatMap((m) =>
    (m.attacks ?? []).map((a) => ({
      war_id: warId,
      attacker_tag: a.attackerTag,
      defender_tag: a.defenderTag,
      stars: a.stars,
      destruction: a.destructionPercentage,
      attack_order: a.order,
    })),
  );
  if (attacks.length > 0) {
    const { error: aErr } = await supabase.from("war_attacks").insert(attacks);
    if (aErr) throw aErr;
  }

  return { recorded: true, state: war.state, attacks: attacks.length };
}
