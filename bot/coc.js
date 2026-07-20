// Cliente mínimo de la API de Clash of Clans para el bot (traducir tag -> nombre).
// En producción usa el proxy de RoyaleAPI (COC_API_BASE_URL=https://cocproxy.royaleapi.dev/v1)
// con el mismo COC_API_TOKEN que Vercel: así no depende de la IP de Fly.

const BASE = process.env.COC_API_BASE_URL;
const TOKEN = process.env.COC_API_TOKEN;

export function encodeTag(tag) {
  return `%23${tag.trim().replace(/^#/, "").toUpperCase()}`;
}

// Fetch genérico a la API de CoC. Devuelve null si falla o falta config.
async function cocGet(path) {
  if (!BASE || !TOKEN) {
    console.error("[coc] FALTAN secrets COC_API_BASE_URL / COC_API_TOKEN en Fly");
    return null;
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[coc] GET ${path} -> HTTP ${res.status} · ${body.slice(0, 200)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[coc] GET", path, err?.message ?? err);
    return null;
  }
}

// Devuelve el jugador (o null si no existe / falta config).
export async function getPlayer(tag) {
  return cocGet(`/players/${encodeTag(tag)}`);
}

// Info del clan (nombre, nº de miembros, puntos…). Usa COC_CLAN_TAG.
export async function getClan(clanTag = process.env.COC_CLAN_TAG) {
  if (!clanTag) return null;
  return cocGet(`/clans/${encodeTag(clanTag)}`);
}

// Guerra normal actual del clan (o null si el registro es privado / no hay).
export async function getCurrentWar(clanTag = process.env.COC_CLAN_TAG) {
  if (!clanTag) return null;
  return cocGet(`/clans/${encodeTag(clanTag)}/currentwar`);
}
