"use server";

import { revalidatePath } from "next/cache";
import { sendClanMessage, discordConfigured } from "@/lib/discord";
import { upsertClanCard } from "@/lib/clan-card";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";

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
  "warns_threshold", // nº de warns vigentes para saltar a "A echar" (def. 3)
  "warns_expiry_days", // días hasta que un warn caduca (def. 90; 0 = nunca)
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
