import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

// Cliente mínimo de la API de Discord con el token del bot. Todo server-side.
const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID;
const CHANNEL = process.env.DISCORD_CHANNEL_ID; // fallback si no hay canal guardado

export interface DiscordMember {
  id: string; // user id (para etiquetar con <@id>)
  username: string; // handle (para guardar)
  label: string; // nombre a mostrar (apodo en el server > global name > username)
}

interface RawMember {
  user?: { id: string; username: string; global_name?: string | null; bot?: boolean };
  nick?: string | null;
}

async function fetchGuildMembers(): Promise<DiscordMember[]> {
  if (!TOKEN || !GUILD) return [];
  try {
    const res = await fetch(`${API}/guilds/${GUILD}/members?limit=1000`, {
      headers: { Authorization: `Bot ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as RawMember[];
    return raw
      .filter((m) => m.user && !m.user.bot)
      .map((m) => ({
        id: m.user!.id,
        username: m.user!.username,
        label: m.nick || m.user!.global_name || m.user!.username,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  } catch {
    return [];
  }
}

// Miembros del servidor de Discord (para el desplegable de vinculación).
// Cacheado: cambian poco y así no llamamos a Discord en cada carga de ficha.
export const getGuildMembers = unstable_cache(fetchGuildMembers, ["discord-guild-members"], {
  revalidate: 600,
});

export interface DiscordRole {
  id: string;
  name: string;
}

async function fetchGuildRoles(): Promise<DiscordRole[]> {
  if (!TOKEN || !GUILD) return [];
  try {
    const res = await fetch(`${API}/guilds/${GUILD}/roles`, {
      headers: { Authorization: `Bot ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as { id: string; name: string; managed?: boolean; position: number }[];
    return raw
      .filter((r) => r.id !== GUILD && !r.managed && r.name !== "@everyone") // fuera @everyone y roles de bots
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}

// Roles del servidor (para etiquetar por rol).
export const getGuildRoles = unstable_cache(fetchGuildRoles, ["discord-guild-roles"], {
  revalidate: 600,
});

export interface DiscordChannel {
  id: string;
  name: string;
}

async function fetchGuildChannels(): Promise<DiscordChannel[]> {
  if (!TOKEN || !GUILD) return [];
  try {
    const res = await fetch(`${API}/guilds/${GUILD}/channels`, {
      headers: { Authorization: `Bot ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as { id: string; name: string; type: number; position: number }[];
    return raw
      .filter((c) => c.type === 0 || c.type === 5) // texto y anuncios
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: `#${c.name}` }));
  } catch {
    return [];
  }
}

// Canales de texto del servidor (para elegir dónde publicar).
export const getGuildChannels = unstable_cache(fetchGuildChannels, ["discord-guild-channels"], {
  revalidate: 600,
});

// Canal por defecto de avisos: el guardado en settings, o el de la env var.
export async function getDefaultChannelId(): Promise<string | null> {
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("settings")
      .select("value")
      .eq("key", "discord_channel_id")
      .maybeSingle();
    return ((data?.value as string | null) ?? null) || CHANNEL || null;
  } catch {
    return CHANNEL || null;
  }
}

// Publica un mensaje en un canal (channelId; si no, el por defecto/env),
// etiquetando de verdad (allowed_mentions) a usuarios/roles (o @everyone/@here).
export async function sendClanMessage(
  content: string,
  opts: { users?: string[]; roles?: string[]; everyone?: boolean } = {},
  channelId?: string | null,
): Promise<boolean> {
  const ch = channelId || CHANNEL;
  if (!TOKEN || !ch) return false;
  try {
    const res = await fetch(`${API}/channels/${ch}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        content,
        allowed_mentions: {
          parse: opts.everyone ? ["everyone"] : [],
          users: (opts.users ?? []).slice(0, 100),
          roles: (opts.roles ?? []).slice(0, 100),
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Publica un mensaje rico: contenido (para menciones), embed y botones a la vez.
// Se usa para los anuncios (embed + botón "Abrir" + aviso @everyone/@Clan).
export async function postRichMessage(
  channelId: string,
  opts: {
    content?: string;
    embed?: Record<string, unknown>;
    components?: unknown[];
    everyone?: boolean;
    roles?: string[];
  } = {},
): Promise<boolean> {
  const ch = channelId || CHANNEL;
  if (!TOKEN || !ch) return false;
  try {
    const res = await fetch(`${API}/channels/${ch}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        content: opts.content || undefined,
        embeds: opts.embed ? [opts.embed] : undefined,
        components: opts.components ?? [],
        allowed_mentions: {
          parse: opts.everyone ? ["everyone"] : [],
          roles: (opts.roles ?? []).slice(0, 100),
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Nombre de fichero seguro y con extensión (Discord referencia attachment://nombre).
function safeName(name: string): string {
  const base = (name || "imagen").replace(/[^a-zA-Z0-9._-]/g, "_");
  return /\.[a-z0-9]+$/i.test(base) ? base : `${base}.png`;
}

// Publica un anuncio. Si viene `file`, se adjunta a Discord (lo aloja Discord;
// NO se guarda en nuestro servidor) y el embed lo muestra vía attachment://.
export async function postAnnouncement(
  channelId: string,
  opts: {
    content?: string;
    embed?: Record<string, unknown>;
    components?: unknown[];
    everyone?: boolean;
    roles?: string[];
    file?: File | null;
  } = {},
): Promise<boolean> {
  const ch = channelId || CHANNEL;
  if (!TOKEN || !ch) return false;
  const allowed_mentions = {
    parse: opts.everyone ? ["everyone"] : [],
    roles: (opts.roles ?? []).slice(0, 100),
  };
  try {
    if (opts.file) {
      const filename = safeName(opts.file.name);
      const embed = opts.embed ? { ...opts.embed, image: { url: `attachment://${filename}` } } : undefined;
      const payload = {
        content: opts.content || undefined,
        embeds: embed ? [embed] : undefined,
        components: opts.components ?? [],
        allowed_mentions,
        attachments: [{ id: 0, filename }],
      };
      const form = new FormData();
      form.append("payload_json", JSON.stringify(payload));
      form.append("files[0]", opts.file, filename); // fetch pone el boundary solo
      const res = await fetch(`${API}/channels/${ch}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${TOKEN}` },
        cache: "no-store",
        body: form,
      });
      return res.ok;
    }
    const res = await fetch(`${API}/channels/${ch}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        content: opts.content || undefined,
        embeds: opts.embed ? [opts.embed] : undefined,
        components: opts.components ?? [],
        allowed_mentions,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Publica un mensaje "plano" (sin etiquetar a nadie) y devuelve su id, o null.
// Se usa para el mensaje fijo de la lista de CWL, que luego se edita.
export async function postChannelMessage(
  channelId: string,
  content: string,
): Promise<string | null> {
  if (!TOKEN || !channelId) return null;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) return null;
    const msg = (await res.json()) as { id?: string };
    return msg.id ?? null;
  } catch {
    return null;
  }
}

// Edita un mensaje existente. Devuelve false si ya no existe (p. ej. lo borraron).
export async function editChannelMessage(
  channelId: string,
  messageId: string,
  content: string,
): Promise<boolean> {
  if (!TOKEN || !channelId || !messageId) return false;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Publica un embed (tarjeta rica) y devuelve su id, o null. Se usa para la
// tarjeta del clan, que luego se edita en su sitio para mantenerla al día.
export async function postChannelEmbed(
  channelId: string,
  embed: Record<string, unknown>,
  components: unknown[] = [],
): Promise<string | null> {
  if (!TOKEN || !channelId) return null;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ embeds: [embed], components, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) return null;
    const msg = (await res.json()) as { id?: string };
    return msg.id ?? null;
  } catch {
    return null;
  }
}

// Edita el embed de un mensaje. Devuelve false si ya no existe (lo borraron).
export async function editChannelEmbed(
  channelId: string,
  messageId: string,
  embed: Record<string, unknown>,
  components: unknown[] = [],
): Promise<boolean> {
  if (!TOKEN || !channelId || !messageId) return false;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ embeds: [embed], components, allowed_mentions: { parse: [] } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Borra un mensaje (p. ej. el mensaje fijo de la lista al eliminar la liga).
export async function deleteChannelMessage(channelId: string, messageId: string): Promise<boolean> {
  if (!TOKEN || !channelId || !messageId) return false;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages/${messageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${TOKEN}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Asigna / retira un rol del servidor a un usuario (necesita permiso Manage Roles
// y que el rol del bot esté por encima del rol en la jerarquía).
// Reintenta ante 429 (rate limit) respetando el retry_after de Discord.
async function roleOp(method: "PUT" | "DELETE", userId: string, roleId: string): Promise<boolean> {
  if (!TOKEN || !GUILD || !userId || !roleId) return false;
  const url = `${API}/guilds/${GUILD}/members/${userId}/roles/${roleId}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bot ${TOKEN}` },
        cache: "no-store",
      });
      if (res.ok) return true; // 204
      if (res.status === 429) {
        const j = (await res.json().catch(() => ({}))) as { retry_after?: number };
        const waitMs = Math.min(5000, Math.ceil(((j.retry_after ?? 1) + 0.1) * 1000));
        await new Promise((r) => setTimeout(r, waitMs));
        continue; // reintenta
      }
      console.error(`[discord] role ${method} ${roleId} -> HTTP ${res.status}`);
      return false;
    } catch {
      return false;
    }
  }
  return false;
}

export const addGuildRole = (userId: string, roleId: string) => roleOp("PUT", userId, roleId);
export const removeGuildRole = (userId: string, roleId: string) => roleOp("DELETE", userId, roleId);

// Roles actuales de un miembro. null si no está en el servidor (404) o error.
// Reintenta ante 429 para no confundir rate limit con "no está en el servidor".
export async function getMemberRoleIds(userId: string): Promise<string[] | null> {
  if (!TOKEN || !GUILD || !userId) return null;
  const url = `${API}/guilds/${GUILD}/members/${userId}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bot ${TOKEN}` }, cache: "no-store" });
      if (res.ok) {
        const m = (await res.json()) as { roles?: string[] };
        return Array.isArray(m.roles) ? m.roles : [];
      }
      if (res.status === 429) {
        const j = (await res.json().catch(() => ({}))) as { retry_after?: number };
        await new Promise((r) => setTimeout(r, Math.min(5000, Math.ceil(((j.retry_after ?? 1) + 0.1) * 1000))));
        continue;
      }
      return null; // 404 (no está en el servidor) u otro error
    } catch {
      return null;
    }
  }
  return null;
}

export const discordConfigured = Boolean(TOKEN && GUILD);
