import { NextResponse } from "next/server";

// ENDPOINT DE DIAGNÓSTICO TEMPORAL — se elimina en cuanto validemos producción.
// No expone secretos: solo la base URL (config) y la IP whitelisteada del token
// (que va dentro del propio JWT como claim de configuración, no es material secreto).
export async function GET() {
  const baseUrl = process.env.COC_API_BASE_URL ?? null;
  const token = process.env.COC_API_TOKEN ?? "";

  let tokenCidrs: unknown = null;
  let scopes: unknown = null;
  let aud: unknown = null;
  let iss: unknown = null;
  let limits: unknown = null;
  const tokenLen = token.length;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    const clientLimit = (payload.limits ?? []).find(
      (l: { type?: string }) => l?.type === "client",
    );
    tokenCidrs = clientLimit?.cidrs ?? null;
    scopes = payload.scopes ?? null;
    aud = payload.aud ?? null;
    iss = payload.iss ?? null;
    limits = payload.limits ?? null;
  } catch {
    tokenCidrs = "no se pudo decodificar el token";
  }

  const parts = token.split(".");
  const segLens = parts.map((p) => p.length);
  // Detecta espacios/saltos de línea invisibles pegados por error.
  const hasWhitespace = /\s/.test(token);

  // Pruebas en vivo desde producción para aislar el fallo.
  async function probe(url: string) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      const text = await r.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text.slice(0, 200);
      }
      return { status: r.status, body: parsed };
    } catch (e) {
      return { error: String(e) };
    }
  }

  const tag = "%232G9RJUYG9";
  const probes = {
    proxy_clan: await probe(`https://proxy.royaleapi.dev/v1/clans/${tag}`),
    proxy_locations: await probe(`https://proxy.royaleapi.dev/v1/locations?limit=1`),
    direct_clan: await probe(`https://api.clashofclans.com/v1/clans/${tag}`),
  };

  return NextResponse.json({
    probes,
    base_url: baseUrl,
    token_present: token.length > 0,
    token_len: tokenLen,
    token_parts: parts.length, // debe ser 3
    token_seg_lens: segLens, // firma (último) debe ser 86
    token_has_whitespace: hasWhitespace, // debe ser false
    token_cidrs: tokenCidrs,
    token_scopes: scopes,
    token_aud: aud,
    token_iss: iss,
    token_limits: limits,
  });
}
