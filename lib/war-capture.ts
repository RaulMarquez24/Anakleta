import type { SupabaseClient } from "@supabase/supabase-js";
import { getWarRecords } from "@/lib/war";

export interface WarCaptureResult {
  recorded: number; // nº de guerras grabadas/actualizadas
  cwl: boolean;
  attacks: number; // ataques totales grabados
}

// Graba en wars + war_attacks la guerra normal actual o TODAS las guerras de
// CWL (una por ronda). Idempotente: upsert por war_tag y reescribe los ataques.
// Resiliente: si algo falla (war log privado, etc.), se maneja arriba.
export async function captureWar(
  supabase: SupabaseClient,
  capturedAt: string,
): Promise<WarCaptureResult> {
  const records = await getWarRecords();
  let recorded = 0;
  let attacks = 0;
  let cwl = false;

  for (const rec of records) {
    cwl = cwl || rec.isCwl;
    const { data: warRow, error: warErr } = await supabase
      .from("wars")
      .upsert(
        {
          war_tag: rec.warTag,
          state: rec.state,
          team_size: rec.teamSize,
          opponent_name: rec.opponentName,
          start_time: rec.startTime,
          end_time: rec.endTime,
          result: rec.result,
          captured_at: capturedAt,
        },
        { onConflict: "war_tag" },
      )
      .select("id")
      .single();
    if (warErr) throw warErr;
    const warId = warRow.id as number;

    await supabase.from("war_attacks").delete().eq("war_id", warId);
    if (rec.attacks.length > 0) {
      const { error: aErr } = await supabase.from("war_attacks").insert(
        rec.attacks.map((a) => ({
          war_id: warId,
          attacker_tag: a.attackerTag,
          defender_tag: a.defenderTag,
          stars: a.stars,
          destruction: a.destruction,
          attack_order: a.order,
        })),
      );
      if (aErr) throw aErr;
    }
    recorded++;
    attacks += rec.attacks.length;
  }

  return { recorded, cwl, attacks };
}
