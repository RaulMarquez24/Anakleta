import { postAnnouncement, discordConfigured } from "@/lib/discord";
import { createServerClient } from "@/lib/supabase/server";

// Vercel serverless limita el body a ~4.5 MB; nos quedamos por debajo con margen.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const svc = createServerClient();
    const { data } = await svc.from("settings").select("value").eq("key", key).maybeSingle();
    return (data?.value as string | null) ?? null;
  } catch {
    return null;
  }
}

// Construye y publica un anuncio (embed) a partir del FormData del compositor.
// La imagen adjunta la aloja Discord (no ocupa nuestro servidor).
export async function sendAnnouncement(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const title = str("title").slice(0, 240);
  const body = str("body").slice(0, 3500);
  if (!title && !body) return { ok: false, error: "Escribe un título o un mensaje." };

  const url = str("url");
  const validUrl = /^https?:\/\/\S+$/.test(url) ? url : "";
  if (url && !validUrl) return { ok: false, error: "El enlace no es válido (debe empezar por http)." };

  const img = str("imageUrl");
  const validImg = /^https?:\/\/\S+$/.test(img) ? img : "";
  if (img && !validImg) return { ok: false, error: "La imagen (URL) no es válida (debe empezar por http)." };

  // Imagen adjunta (opcional). La aloja Discord.
  const raw = formData.get("image");
  let file: File | null = null;
  if (raw instanceof File && raw.size > 0) {
    if (!raw.type.startsWith("image/"))
      return { ok: false, error: "El archivo adjunto debe ser una imagen." };
    if (raw.size > MAX_IMAGE_BYTES)
      return { ok: false, error: "La imagen es demasiado grande (máx. 4 MB)." };
    file = raw;
  }

  const channelId = str("channelId") || (await getSettingValue("announcements_channel_id")) || "";
  if (!channelId) return { ok: false, error: "Elige un canal para el anuncio." };

  // Aviso opcional (fuera del embed, para que la mención funcione).
  const mention = str("mention") || "none";
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
    image: validImg ? { url: validImg } : undefined, // si hay adjunto, lo sobreescribe postAnnouncement
    color: 0xe0a81e,
    footer: { text: "Añakleta" },
    timestamp: new Date().toISOString(),
  };
  const components = validUrl
    ? [{ type: 1, components: [{ type: 2, style: 5, label: "Abrir", url: validUrl }] }]
    : [];

  const ok = await postAnnouncement(channelId, { content, embed, components, everyone, roles, file });
  if (!ok) return { ok: false, error: "No se pudo publicar (revisa el bot y el canal)." };
  return { ok: true };
}
