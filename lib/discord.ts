import { unstable_cache } from "next/cache";

// Cliente mínimo de la API de Discord con el token del bot. Todo server-side.
const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID;
const CHANNEL = process.env.DISCORD_CHANNEL_ID;

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

// Publica un mensaje en el canal, etiquetando de verdad (allowed_mentions) a los
// usuarios/roles indicados (o @everyone/@here). Devuelve true si se envió.
export async function sendClanMessage(
  content: string,
  opts: { users?: string[]; roles?: string[]; everyone?: boolean } = {},
): Promise<boolean> {
  if (!TOKEN || !CHANNEL) return false;
  try {
    const res = await fetch(`${API}/channels/${CHANNEL}/messages`, {
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

export const discordConfigured = Boolean(TOKEN && GUILD);
