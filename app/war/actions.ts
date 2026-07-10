"use server";

import { getCurrentWar } from "@/lib/war";
import { sendClanMessage, discordConfigured } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";

export interface NotifyResult {
  ok: boolean;
  pinged?: number; // cuántos se etiquetaron (tienen Discord)
  unlinked?: number; // pendientes sin Discord vinculado
  error?: string;
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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

  // Mapear tag -> discord_id de los pendientes.
  const svc = createServerClient();
  const { data } = await svc
    .from("members")
    .select("*")
    .in(
      "tag",
      war.pending.map((p) => p.tag),
    );
  const discByTag = new Map<string, string>();
  for (const m of data ?? []) {
    const id = (m.discord_id as string | null) ?? null;
    if (id) discByTag.set(m.tag as string, id);
  }

  const mentionIds: string[] = [];
  const lines = war.pending.map((p) => {
    const id = discByTag.get(p.tag);
    if (id) {
      mentionIds.push(id);
      return `• <@${id}>`;
    }
    return `• ${p.name}`;
  });

  const header = war.isCwl
    ? `⚔️ **CWL · Ronda ${war.round ?? "?"} vs ${war.opponentName ?? "—"}**`
    : `⚔️ **Guerra vs ${war.opponentName ?? "—"}**`;
  const left = timeLeft(war.endTime);
  const content =
    `${header}\n` +
    `Quedan **${war.pending.length}** sin atacar${left ? ` · ⏰ ${left}` : ""}:\n` +
    `${lines.join("\n")}\n` +
    `¡A por ellos! 💪`;

  const sent = await sendClanMessage(content, { users: mentionIds });
  if (!sent) return { ok: false, error: "No se pudo enviar (revisa el bot y el canal)." };

  return { ok: true, pinged: mentionIds.length, unlinked: war.pending.length - mentionIds.length };
}
