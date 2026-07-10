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
    console.error("[coc] faltan COC_API_BASE_URL / COC_API_TOKEN");
    return null;
  }
  try {
    const res = await fetch(`${BASE}/players/${encodeTag(tag)}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("[coc] getPlayer:", err?.message ?? err);
    return null;
  }
}
