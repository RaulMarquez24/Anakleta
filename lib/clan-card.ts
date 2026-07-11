import { getClan } from "@/lib/coc";
import type { CocClan } from "@/lib/coc-types";
import { createServerClient } from "@/lib/supabase/server";
import { postChannelEmbed, editChannelEmbed } from "@/lib/discord";

// Tarjeta viva del clan en Discord: un embed que se edita en su sitio en cada
// sincronización, así refleja el mismo estado que la app (escudo, nivel,
// miembros, liga, puntos, racha…). El canal y el id del mensaje viven en
// `settings` para poder editar siempre el mismo mensaje.

const CARD_CHANNEL_KEY = "clan_card_channel_id";
const CARD_MESSAGE_KEY = "clan_card_message_id";

async function getSetting(key: string): Promise<string | null> {
  try {
    const svc = createServerClient();
    const { data } = await svc.from("settings").select("value").eq("key", key).maybeSingle();
    return (data?.value as string | null) ?? null;
  } catch {
    return null;
  }
}

async function setSettingValue(key: string, value: string | null): Promise<void> {
  try {
    const svc = createServerClient();
    await svc.from("settings").upsert({ key, value }, { onConflict: "key" });
  } catch {
    /* best-effort */
  }
}

export function buildClanEmbed(clan: CocClan): Record<string, unknown> {
  const badge = clan.badgeUrls?.large || clan.badgeUrls?.medium || clan.badgeUrls?.small;
  return {
    title: `${clan.name}  ${clan.tag}`,
    url: `https://link.clashofclans.com/?action=OpenClanProfile&tag=${encodeURIComponent(clan.tag)}`,
    description: clan.description ? clan.description.slice(0, 300) : undefined,
    color: 0xe0a81e, // dorado
    thumbnail: badge ? { url: badge } : undefined,
    fields: [
      { name: "Nivel", value: `${clan.clanLevel}`, inline: true },
      { name: "Miembros", value: `${clan.members}/50`, inline: true },
      { name: "Puntos", value: `${clan.clanPoints ?? "—"}`, inline: true },
      { name: "Liga de guerra", value: clan.warLeague?.name ?? "—", inline: true },
      { name: "Racha de guerra", value: `${clan.warWinStreak ?? 0}`, inline: true },
      { name: "Guerras ganadas", value: `${clan.warWins ?? 0}`, inline: true },
      { name: "Trofeos para entrar", value: `${clan.requiredTrophies ?? 0}`, inline: true },
    ],
    footer: { text: "Añakleta · se actualiza solo" },
    timestamp: new Date().toISOString(),
  };
}

export interface ClanCardResult {
  ok: boolean;
  error?: string;
  posted?: boolean; // se publicó uno nuevo
  edited?: boolean; // se editó el existente
}

// Publica o actualiza la tarjeta del clan. Si se le pasa `clanArg` (p. ej. desde
// el snapshot, que ya lo ha pedido) no vuelve a llamar a la API de CoC.
export async function upsertClanCard(clanArg?: CocClan): Promise<ClanCardResult> {
  const channelId = await getSetting(CARD_CHANNEL_KEY);
  if (!channelId) return { ok: false, error: "No hay canal asignado para la tarjeta del clan." };

  let clan = clanArg;
  if (!clan) {
    try {
      clan = await getClan<CocClan>();
    } catch {
      return { ok: false, error: "No se pudo leer el clan (API de CoC)." };
    }
  }

  const embed = buildClanEmbed(clan);
  const messageId = await getSetting(CARD_MESSAGE_KEY);

  // Si ya hay tarjeta, la editamos en su sitio.
  if (messageId) {
    const ok = await editChannelEmbed(channelId, messageId, embed);
    if (ok) return { ok: true, edited: true };
    // Si falló (la borraron o cambió el canal), publicamos una nueva.
  }

  const newId = await postChannelEmbed(channelId, embed);
  if (!newId) return { ok: false, error: "No se pudo publicar (revisa el bot y el canal)." };
  await setSettingValue(CARD_MESSAGE_KEY, newId);
  return { ok: true, posted: true };
}
