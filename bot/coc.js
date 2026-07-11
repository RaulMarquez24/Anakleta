// Cliente mínimo de la API de Clash of Clans para el bot (traducir tag -> nombre).
// En producción usa el proxy de RoyaleAPI (COC_API_BASE_URL=https://cocproxy.royaleapi.dev/v1)
// con el mismo COC_API_TOKEN que Vercel: así no depende de la IP de Fly.

const BASE = process.env.COC_API_BASE_URL;
const TOKEN = process.env.COC_API_TOKEN;

export function encodeTag(tag) {
  return `%23${tag.trim().replace(/^#/, "").toUpperCase()}`;
}

// Devuelve el jugador (o null si no existe / falta config).
export async function getPlayer(tag) {
  if (!BASE || !TOKEN) {
    console.error("[coc] FALTAN secrets COC_API_BASE_URL / COC_API_TOKEN en Fly");
    return null;
  }
  try {
    const url = `${BASE}/players/${encodeTag(tag)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 403 = IP no autorizada (token no whitelisteado al proxy); 404 = tag inexistente.
      console.error(`[coc] getPlayer ${tag} -> HTTP ${res.status} · ${body.slice(0, 200)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[coc] getPlayer:", err?.message ?? err);
    return null;
  }
}
