"use server";

import { getCurrentWar } from "@/lib/war";
import { discordConfigured } from "@/lib/discord";
import { sendPendingWarNotice } from "@/lib/war-notify";
import { getCurrentUser } from "@/lib/supabase/current-user";

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
