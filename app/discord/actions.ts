"use server";

import { sendClanMessage, discordConfigured } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";

// role: "" (ninguno) | "everyone" | "here" | id de rol.
export async function sendCustomMessage(
  text: string,
  userIds: string[],
  role: string,
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

  const sent = await sendClanMessage(content, {
    users,
    roles: everyone || !role ? [] : [role],
    everyone,
  });
  if (!sent) return { ok: false, error: "No se pudo enviar (revisa el bot y el canal)." };
  return { ok: true };
}
