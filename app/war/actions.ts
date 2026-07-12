"use server";

import { getCurrentWar } from "@/lib/war";
import { discordConfigured } from "@/lib/discord";
import { sendPendingWarNotice } from "@/lib/war-notify";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";

// Corrige a mano el "2º ataque (ayuda)" de un miembro en una guerra concreta:
// should=true (sí puede ayudar) / false (no hace falta). Sobreescribe el filtro
// automático por TH. Se guarda por guerra (war_key = hora de inicio) y lo ven
// todos los colíderes.
export async function setWarHelpOverride(
  warKey: string,
  tag: string,
  should: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!warKey || !tag) return { ok: false, error: "Datos incompletos." };
  try {
    const svc = createServerClient();
    const { error } = await svc.from("war_help_overrides").upsert(
      { war_key: warKey, tag, should, updated_by: user.email ?? null, updated_at: new Date().toISOString() },
      { onConflict: "war_key,tag" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface NotifyResult {
  ok: boolean;
  pinged?: number; // cuántos se etiquetaron (tienen Discord)
  unlinked?: number; // pendientes sin Discord vinculado
  error?: string;
}

// Publica en Discord la lista de quién falta por atacar, etiquetando (@) a los
// que tienen cuenta vinculada. Solo desde una guerra en curso.
export async function notifyPendingAttacks(): Promise<NotifyResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };

  const war = await getCurrentWar().catch(() => null);
  if (!war || war.state !== "inWar") return { ok: false, error: "No hay guerra en curso." };
  if (war.pending.length === 0) return { ok: false, error: "Ya han atacado todos." };

  const r = await sendPendingWarNotice(war);
  if (!r.sent) return { ok: false, error: "No se pudo enviar (revisa el bot y el canal)." };
  return { ok: true, pinged: r.pinged, unlinked: r.unlinked };
}
