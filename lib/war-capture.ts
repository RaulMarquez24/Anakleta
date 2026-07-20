import type { SupabaseClient } from "@supabase/supabase-js";
import { getWarRecords, getWarLog, type WarLogEntry } from "@/lib/war";

export interface WarCaptureResult {
  recorded: number; // nº de guerras grabadas/actualizadas
  cwl: boolean;
  attacks: number; // ataques totales grabados
  finalized: number; // guerras cerradas reconciliadas con el warlog (o marcadas)
}

// Graba en wars + war_attacks la guerra normal actual o TODAS las guerras de
// CWL (una por ronda). Idempotente: upsert por war_tag y reescribe los ataques.
// Resiliente: si algo falla (war log privado, etc.), se maneja arriba.
export async function captureWar(
  supabase: SupabaseClient,
  capturedAt: string,
): Promise<WarCaptureResult> {
  // Rondas de CWL ya guardadas como terminadas: no hace falta volver a bajarlas
  // ni reescribirlas (una guerra cerrada ya no cambia).
  const { data: finalized } = await supabase
    .from("wars")
    .select("war_tag")
    .eq("state", "warEnded")
    .eq("is_cwl", true);
  const finalizedTags = new Set(
    (finalized ?? []).map((w) => w.war_tag as string).filter(Boolean),
  );

  const records = await getWarRecords(undefined, finalizedTags);
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
          is_cwl: rec.isCwl,
          season: rec.season,
          round: rec.round,
          state: rec.state,
          team_size: rec.teamSize,
          opponent_name: rec.opponentName,
          clan_stars: rec.clanStars,
          opponent_stars: rec.opponentStars,
          clan_destruction: rec.clanDestruction,
          opponent_destruction: rec.opponentDestruction,
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

    // Reescribe ataques y alineación de esta guerra.
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

    await supabase.from("war_members").delete().eq("war_id", warId);
    if (rec.members.length > 0) {
      const { error: mErr } = await supabase.from("war_members").insert(
        rec.members.map((m) => ({
          war_id: warId,
          tag: m.tag,
          name: m.name,
          map_position: m.mapPosition,
          town_hall: m.townHall,
          attacks_used: m.attacksUsed,
          stars: m.stars,
          destruction: m.destruction,
        })),
      );
      if (mErr) throw mErr;
    }

    recorded++;
    attacks += rec.attacks.length;
  }

  const finalizedCount = await finalizeEndedWars(supabase);

  return { recorded, cwl, attacks, finalized: finalizedCount };
}

// Fila mínima de una guerra pendiente de finalizar.
interface PendingWar {
  id: number;
  opponent_name: string | null;
  end_time: string | null;
  result: string | null;
  clan_stars: number | null;
  opponent_stars: number | null;
  clan_destruction: number | null;
  opponent_destruction: number | null;
}

// Reconcilia guerras normales YA cerradas con el warlog para dejar el marcador
// final oficial (estrellas/%/resultado), y las marca finalized=true para no
// volver a tocarlas nunca (no tiene sentido recargar guerras de hace meses).
// Solo baja el warlog si hay algo pendiente. Best-effort: si el warlog es
// privado o una guerra es demasiado antigua para estar en él, se finaliza con
// lo que haya (derivando el resultado) para dejar de reintentar.
async function finalizeEndedWars(supabase: SupabaseClient): Promise<number> {
  const nowMs = Date.now();
  // Guerras normales ya terminadas (por end_time) aún no finalizadas.
  let pending: PendingWar[] = [];
  try {
    const { data } = await supabase
      .from("wars")
      .select(
        "id, opponent_name, end_time, result, clan_stars, opponent_stars, clan_destruction, opponent_destruction, finalized, is_cwl",
      )
      .eq("is_cwl", false)
      .lt("end_time", new Date(nowMs).toISOString());
    pending = (data ?? [])
      .filter((w) => w.finalized !== true)
      .map((w) => ({
        id: w.id as number,
        opponent_name: (w.opponent_name as string) ?? null,
        end_time: (w.end_time as string) ?? null,
        result: (w.result as string) ?? null,
        clan_stars: (w.clan_stars as number) ?? null,
        opponent_stars: (w.opponent_stars as number) ?? null,
        clan_destruction: (w.clan_destruction as number) ?? null,
        opponent_destruction: (w.opponent_destruction as number) ?? null,
      }));
  } catch {
    return 0; // columna finalized aún no existe (migración pendiente): no bloquear
  }
  if (pending.length === 0) return 0;

  const log = await getWarLog();
  let done = 0;

  for (const w of pending) {
    const match = matchWarLog(log, w);
    if (match) {
      await patchWar(supabase, w.id, {
        state: "warEnded",
        result: match.result ?? deriveResult(match),
        clan_stars: match.clanStars,
        opponent_stars: match.opponentStars,
        clan_destruction: match.clanDestruction,
        opponent_destruction: match.opponentDestruction,
        ...(match.teamSize != null ? { team_size: match.teamSize } : {}),
      });
      done++;
    } else if (w.end_time && Date.parse(w.end_time) < nowMs - 2 * 86_400_000) {
      // No está en el warlog y es claramente vieja (>2 días): finalizar con lo
      // almacenado para no reintentar en cada snapshot.
      await patchWar(supabase, w.id, {
        state: "warEnded",
        result: w.result ?? deriveFromStored(w),
      });
      done++;
    }
    // Reciente y sin match aún (warlog puede tardar): se reintenta al siguiente.
  }
  return done;
}

// Empareja una guerra guardada con su entrada del warlog por rival + endTime.
function matchWarLog(log: WarLogEntry[], w: PendingWar): WarLogEntry | null {
  if (!w.end_time) return null;
  const wEnd = Date.parse(w.end_time);
  const name = w.opponent_name?.trim().toLowerCase() ?? null;
  let best: WarLogEntry | null = null;
  let bestDiff = Infinity;
  for (const e of log) {
    if (!e.endTime) continue;
    const diff = Math.abs(Date.parse(e.endTime) - wEnd);
    const nameEq = name != null && e.opponentName?.trim().toLowerCase() === name;
    // Mismo rival dentro de 24h, o cualquier rival dentro de 6h (endTime único).
    const ok = (nameEq && diff < 24 * 3_600_000) || diff < 6 * 3_600_000;
    if (ok && diff < bestDiff) {
      best = e;
      bestDiff = diff;
    }
  }
  return best;
}

function deriveResult(e: WarLogEntry): string {
  const a = e.clanStars ?? 0,
    b = e.opponentStars ?? 0,
    ca = e.clanDestruction ?? 0,
    cb = e.opponentDestruction ?? 0;
  return a > b ? "win" : a < b ? "lose" : ca > cb ? "win" : ca < cb ? "lose" : "tie";
}

function deriveFromStored(w: PendingWar): string {
  const a = w.clan_stars ?? 0,
    b = w.opponent_stars ?? 0,
    ca = w.clan_destruction ?? 0,
    cb = w.opponent_destruction ?? 0;
  return a > b ? "win" : a < b ? "lose" : ca > cb ? "win" : ca < cb ? "lose" : "tie";
}

async function patchWar(
  supabase: SupabaseClient,
  id: number,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("wars").update({ ...fields, finalized: true }).eq("id", id);
  if (error) {
    // Fallback por si finalized aún no existe: al menos deja el estado/resultado.
    await supabase.from("wars").update(fields).eq("id", id);
  }
}
