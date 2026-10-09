"use server";

import { revalidatePath } from "next/cache";
import {
  sendClanMessage,
  discordConfigured,
  getChannelMessages,
  postChannelMessage,
  type RawChannelMessage,
} from "@/lib/discord";
import { translateMarkdown } from "@/lib/translate";
import { upsertClanCard } from "@/lib/clan-card";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";

// Texto traducible de un mensaje (contenido + embeds), sin menciones.
function updateText(m: RawChannelMessage): string {
  const parts: string[] = [];
  if (m.content?.trim()) parts.push(m.content);
  for (const e of m.embeds ?? []) {
    if (e.title) parts.push(`## ${e.title}`);
    if (e.description) parts.push(e.description);
    for (const f of e.fields ?? []) parts.push(`**${f.name}**\n${f.value}`);
  }
  return parts
    .join("\n\n")
    .replace(/<@&?\d+>/g, "")
    .replace(/@everyone|@here/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunk2000(text: string): string[] {
  const chunks: string[] = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if (buf.length + line.length + 1 > 1950) {
      if (buf) chunks.push(buf);
      buf = "";
    }
    buf += (buf ? "\n" : "") + line;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// Traduce manualmente el último parte. `origin` = canal de donde leer (por
// defecto el de Actualizaciones); `destination` = canal donde publicar (por
// defecto el mismo que origen).
export async function translateLastUpdate(
  origin?: string,
  destination?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };

  const svc = createServerClient();
  let readCh = origin || null;
  let postCh = destination || null;
  if (!readCh || !postCh) {
    const { data } = await svc
      .from("settings")
      .select("key, value")
      .in("key", ["updates_channel_id", "updates_dest_channel_id"]);
    const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
    if (!readCh) readCh = map.get("updates_channel_id") || process.env.UPDATES_CHANNEL_ID || null;
    if (!postCh) postCh = map.get("updates_dest_channel_id") || null;
  }
  if (!readCh) return { ok: false, error: "Configura el canal de origen en Actualizaciones." };
  postCh = postCh || readCh; // sin destino -> publica en el mismo de origen

  const msgs = await getChannelMessages(readCh, 15);
  // El más reciente que NO sea ya una traducción nuestra y tenga contenido real.
  const source = msgs.find((m) => !(m.content ?? "").startsWith("🌐") && updateText(m).length >= 15);
  if (!source) return { ok: false, error: "No encontré ningún parte que traducir en el canal de origen." };

  const translated = await translateMarkdown(updateText(source));
  const guild = process.env.DISCORD_GUILD_ID;
  const link = guild ? `https://discord.com/channels/${guild}/${readCh}/${source.id}` : "";
  const body =
    `🌐 **Traducción al español**\n\n${translated}` + (link ? `\n\n-# Fuente (original): ${link}` : "");
  for (const chunk of chunk2000(body)) {
    const ok = await postChannelMessage(postCh, chunk);
    if (!ok) return { ok: false, error: "No se pudo publicar (revisa permisos del bot en el canal de destino)." };
  }
  return { ok: true };
}

// Claves de settings que se pueden editar desde el panel (whitelist).
const EDITABLE_SETTINGS = new Set([
  "discord_channel_id",
  "cwl_list_channel_id",
  "cwl_announce_channel_id",
  "welcome_channel_id",
  "cwl_role_id",
  "clan_role_id",
  "clan_card_channel_id",
  "announcements_channel_id",
  "rules_channel_id", // canal donde publicar las normas (si no, usa el de anuncios)
  "warns_threshold", // nº de warns vigentes para saltar a "A echar" (def. 3)
  "warns_expiry_days", // días hasta que un warn caduca (def. 90; 0 = nunca)
  "coleader_role_id", // rol que puede apuntar a otros con /apuntar @usuario
  "cards_channel_id", // tablón de cartas repetidas (evento del Clashiversario)
  "cards_enabled", // "1" activa el evento de cartas (si no, ni aparece el comando)
  "updates_channel_id", // canal donde el bot ESCUCHA el parte de CoC
  "updates_dest_channel_id", // canal donde PUBLICA la traducción (si no, el mismo)
]);

// Publica o actualiza la tarjeta viva del clan en el canal configurado.
export async function publishClanCard(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };
  const r = await upsertClanCard();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Guarda un ajuste (canal/rol) en la tabla settings.
export async function setSetting(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!EDITABLE_SETTINGS.has(key)) return { ok: false, error: "Ajuste no permitido." };
  const svc = createServerClient();
  const { error } = await svc
    .from("settings")
    .upsert({ key, value: value || null }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/discord");
  return { ok: true };
}

// Fija el canal por defecto para los avisos (guerra + cron).
export async function setDefaultChannel(channelId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const svc = createServerClient();
  const { error } = await svc
    .from("settings")
    .upsert({ key: "discord_channel_id", value: channelId || null }, { onConflict: "key" });
  return { ok: !error };
}

// role: "" (ninguno) | "everyone" | "here" | id de rol.
export async function sendCustomMessage(
  text: string,
  userIds: string[],
  role: string,
  channelId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };

  const body = text.trim().slice(0, 1800);
  const users = userIds.filter(Boolean).slice(0, 100);

  // Construye las menciones al final del mensaje.
  const mentions: string[] = [];
  const everyone = role === "everyone" || role === "here";
  if (role === "everyone") mentions.push("@everyone");
  else if (role === "here") mentions.push("@here");
  else if (role) mentions.push(`<@&${role}>`);
  for (const id of users) mentions.push(`<@${id}>`);

  if (!body && mentions.length === 0) return { ok: false, error: "Escribe un mensaje o elige a quién avisar." };

  const content = [body, mentions.join(" ")].filter(Boolean).join("\n\n");

  const sent = await sendClanMessage(
    content,
    { users, roles: everyone || !role ? [] : [role], everyone },
    channelId,
  );
  if (!sent) return { ok: false, error: "No se pudo enviar (revisa el bot y el canal)." };
  return { ok: true };
}
