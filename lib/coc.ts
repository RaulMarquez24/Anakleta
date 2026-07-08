// Cliente de la API oficial de Clash of Clans.
// Base URL y token vienen SIEMPRE de entorno: en local se apunta directo a
// api.clashofclans.com; en producción (Vercel) al proxy de RoyaleAPI. El código
// no cambia entre entornos, solo las env vars (COC_API_BASE_URL / COC_API_TOKEN).

const BASE_URL = process.env.COC_API_BASE_URL;
const TOKEN = process.env.COC_API_TOKEN;

/** Error con el status HTTP de la API de CoC, para mapearlo a la respuesta. */
export class CocApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CocApiError";
  }
}

/** Codifica un tag de clan/jugador para la URL: el `#` va como `%23`. */
export function encodeTag(tag: string): string {
  // Acepta el tag con o sin `#` y normaliza a mayúsculas.
  const clean = tag.trim().replace(/^#/, "").toUpperCase();
  return `%23${clean}`;
}

/**
 * Llama a un endpoint de la API de CoC y devuelve el JSON parseado.
 * `path` es relativo a la base URL, empezando por `/` (p.ej. `/clans/%23...`).
 */
export async function cocFetch<T = unknown>(path: string): Promise<T> {
  if (!BASE_URL) throw new CocApiError("Falta COC_API_BASE_URL", 500);
  if (!TOKEN) throw new CocApiError("Falta COC_API_TOKEN", 500);

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
    },
    // Los datos cambian con el tiempo; no cachear la petición a la API.
    cache: "no-store",
  });

  if (!res.ok) {
    let details: unknown;
    try {
      details = await res.json();
    } catch {
      details = await res.text().catch(() => undefined);
    }
    throw new CocApiError(
      `La API de CoC respondió ${res.status}`,
      res.status,
      details,
    );
  }

  return res.json() as Promise<T>;
}

/** Info del clan y su lista de miembros. Usa COC_CLAN_TAG si no se pasa tag. */
export function getClan<T = unknown>(clanTag = process.env.COC_CLAN_TAG ?? ""): Promise<T> {
  if (!clanTag) throw new CocApiError("Falta COC_CLAN_TAG", 500);
  return cocFetch<T>(`/clans/${encodeTag(clanTag)}`);
}

/** Perfil de un jugador individual. */
export function getPlayer<T = unknown>(playerTag: string): Promise<T> {
  return cocFetch<T>(`/players/${encodeTag(playerTag)}`);
}
