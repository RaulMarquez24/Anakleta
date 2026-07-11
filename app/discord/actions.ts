"use server";

import { revalidatePath } from "next/cache";
import { sendClanMessage, postRichMessage, discordConfigured } from "@/lib/discord";
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
]);

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const svc = createServerClient();
    const { data } = await svc.from("settings").select("value").eq("key", key).maybeSingle();
    return (data?.value as string | null) ?? null;
  } catch {
    return null;
  }
}

// Publica un anuncio (embed) en el canal de anuncios, con enlace y aviso opcionales.
// mention: "none" | "everyone" | "clan" (usa clan_role_id).
export async function publishAnnouncement(input: {
  title: string;
  body: string;
  url?: string;
  imageUrl?: string;
  mention?: "none" | "everyone" | "clan";
  channelId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };

  const title = input.title.trim().slice(0, 240);
  const body = input.body.trim().slice(0, 3500);
  if (!title && !body) return { ok: false, error: "Escribe un título o un mensaje." };

  const url = (input.url ?? "").trim();
  const validUrl = /^https?:\/\/\S+$/.test(url) ? url : "";
  if (url && !validUrl) return { ok: false, error: "El enlace no es válido (debe empezar por http)." };

  const img = (input.imageUrl ?? "").trim();
  const validImg = /^https?:\/\/\S+$/.test(img) ? img : "";
  if (img && !validImg) return { ok: false, error: "La imagen no es válida (debe ser una URL http)." };

  const channelId =
    input.channelId || (await getSettingValue("announcements_channel_id")) || "";
  if (!channelId) return { ok: false, error: "Elige un canal para el anuncio." };

  // Aviso opcional (fuera del embed, para que la mención funcione).
  const mention = input.mention ?? "none";
  let content: string | undefined;
  let everyone = false;
  const roles: string[] = [];
  if (mention === "everyone") {
    content = "@everyone";
    everyone = true;
  } else if (mention === "clan") {
    const roleId = await getSettingValue("clan_role_id");
    if (roleId) {
      content = `<@&${roleId}>`;
      roles.push(roleId);
    }
  }

  const embed: Record<string, unknown> = {
    title: `📢 ${title || "Anuncio"}`,
    description: body || undefined,
    url: validUrl || undefined,
    image: validImg ? { url: validImg } : undefined,
    color: 0xe0a81e,
    footer: { text: "Añakleta" },
    timestamp: new Date().toISOString(),
  };
  const components = validUrl
    ? [{ type: 1, components: [{ type: 2, style: 5, label: "Abrir", url: validUrl }] }]
    : [];

  const ok = await postRichMessage(channelId, { content, embed, components, everyone, roles });
  if (!ok) return { ok: false, error: "No se pudo publicar (revisa el bot y el canal)." };
  return { ok: true };
}

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
