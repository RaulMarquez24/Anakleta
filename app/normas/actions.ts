"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { postChannelMessage, editChannelMessage, discordConfigured } from "@/lib/discord";
import {
  ALL_RULE_FIELDS,
  RULE_TEXT_BLOCKS,
  getRulesText,
  getAllTokenValues,
  applyRuleTokens,
} from "@/lib/rules";

const FIELD_BY_KEY = new Map(ALL_RULE_FIELDS.map((f) => [f.key, f]));
const TEXT_KEYS = new Set(RULE_TEXT_BLOCKS.map((b) => b.key));

// Guarda los valores de las normas (settings). Solo claves de RULE_FIELDS, con
// clamp a sus límites. Cualquier colíder autenticado.
export async function saveRules(
  values: Record<string, number>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };

  const rows: { key: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(values)) {
    const f = FIELD_BY_KEY.get(key);
    if (!f) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const clamped = Math.max(f.min, Math.min(f.max, Math.round(n)));
    rows.push({ key, value: String(clamped) });
  }
  if (rows.length === 0) return { ok: false, error: "Nada que guardar." };

  const svc = createServerClient();
  const { error } = await svc.from("settings").upsert(rows, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  // Un valor (token) puede aparecer en cualquier bloque: re-edita los publicados.
  await syncPublishedRules();

  // Afecta a cómo se clasifican ataques y a la actividad.
  revalidatePath("/normas");
  revalidatePath("/actividad");
  return { ok: true };
}

// Guarda el TEXTO de las normas (los bloques editables).
export async function saveRulesText(
  values: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };

  const rows: { key: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!TEXT_KEYS.has(key)) continue;
    rows.push({ key, value: String(raw ?? "").slice(0, 3500) });
  }
  if (rows.length === 0) return { ok: false, error: "Nada que guardar." };

  const svc = createServerClient();
  const { error } = await svc.from("settings").upsert(rows, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  // Re-edita en Discord los bloques que se acaban de cambiar (si están publicados).
  await syncPublishedRules(rows.map((r) => r.key));

  revalidatePath("/normas");
  return { ok: true };
}

// Re-edita en Discord los mensajes de las normas ya publicadas para reflejar el
// texto/valores actuales. Solo toca los bloques que tengan mensaje guardado.
async function syncPublishedRules(blockKeys?: string[]): Promise<void> {
  if (!discordConfigured) return;
  const svc = createServerClient();
  const [text, tokens] = await Promise.all([getRulesText(), getAllTokenValues()]);
  const keys =
    blockKeys && blockKeys.length > 0
      ? RULE_TEXT_BLOCKS.filter((b) => blockKeys.includes(b.key))
      : RULE_TEXT_BLOCKS;
  for (const b of keys) {
    const ref = await getSetting(`rules_msg_${b.key}`);
    if (!ref) continue;
    let parsed: { c?: string; m?: string; e?: boolean };
    try {
      parsed = JSON.parse(ref);
    } catch {
      continue;
    }
    if (!parsed.c || !parsed.m) continue;
    let content = applyRuleTokens((text[b.key] ?? b.default).trim(), tokens);
    if (parsed.e) content = `${content}\n\n||@everyone||`;
    const ok = await editChannelMessage(parsed.c, parsed.m, content.slice(0, 1990));
    // Si el mensaje ya no existe (lo borraron), olvida la referencia.
    if (!ok) await svc.from("settings").delete().eq("key", `rules_msg_${b.key}`);
  }
}

async function getSetting(key: string): Promise<string | null> {
  try {
    const svc = createServerClient();
    const { data } = await svc.from("settings").select("value").eq("key", key).maybeSingle();
    return (data?.value as string | null) ?? null;
  } catch {
    return null;
  }
}

// Publica en Discord los bloques de normas indicados (uno por mensaje). Usa el
// canal elegido (y lo recuerda como rules_channel_id); si no, el de reglas o el
// de anuncios. Con `everyone`, avisa a @everyone en el primer mensaje.
export async function publishRules(
  blockKeys?: string[],
  opts?: { channelId?: string; everyone?: boolean },
): Promise<{ ok: boolean; sent?: number; error?: string; publishedAt?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };

  const chosen = opts?.channelId?.trim();
  const channelId =
    chosen || (await getSetting("rules_channel_id")) || (await getSetting("announcements_channel_id"));
  if (!channelId)
    return { ok: false, error: "Elige el canal donde publicar las normas." };

  const svc = createServerClient();
  // Recuerda el canal elegido para la próxima vez.
  if (chosen) {
    await svc.from("settings").upsert({ key: "rules_channel_id", value: chosen }, { onConflict: "key" });
  }

  const [text, tokens] = await Promise.all([getRulesText(), getAllTokenValues()]);
  const keys =
    blockKeys && blockKeys.length > 0
      ? RULE_TEXT_BLOCKS.filter((b) => blockKeys.includes(b.key))
      : RULE_TEXT_BLOCKS;

  let sent = 0;
  for (const b of keys) {
    // Sustituye los tokens ({horas_robo_espejo}, …) por los valores configurados.
    let content = applyRuleTokens((text[b.key] ?? b.default).trim(), tokens);
    if (!content) continue;
    // @everyone oculto (spoiler) al final del bloque: no se ve pero notifica.
    if (opts?.everyone) content = `${content}\n\n||@everyone||`;
    const id = await postChannelMessage(channelId, content.slice(0, 1990), {
      everyone: !!opts?.everyone,
    });
    if (!id) return { ok: false, sent, error: `No se pudo publicar «${b.title}».` };
    // Guarda el mensaje publicado para poder editarlo cuando cambien los valores.
    await svc.from("settings").upsert(
      {
        key: `rules_msg_${b.key}`,
        value: JSON.stringify({ c: channelId, m: id, e: !!opts?.everyone }),
      },
      { onConflict: "key" },
    );
    sent++;
  }

  // Marca la hora de publicación para el cooldown de 7 min.
  const publishedAt = new Date().toISOString();
  await svc
    .from("settings")
    .upsert({ key: "rules_last_published_at", value: publishedAt }, { onConflict: "key" });

  return { ok: true, sent, publishedAt };
}
