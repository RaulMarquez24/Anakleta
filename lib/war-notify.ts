import { createServerClient } from "@/lib/supabase/server";
import { sendClanMessage } from "@/lib/discord";
import type { WarView } from "@/lib/war";

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Construye y publica en Discord el aviso de "faltan por atacar" de una guerra,
// etiquetando (@) a los pendientes con Discord vinculado. Reusado por el botón
// manual y por el recordatorio automático.
export async function sendPendingWarNotice(
  war: WarView,
): Promise<{ sent: boolean; pinged: number; unlinked: number }> {
  if (war.pending.length === 0) return { sent: false, pinged: 0, unlinked: 0 };

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
  return { sent, pinged: mentionIds.length, unlinked: war.pending.length - mentionIds.length };
}
