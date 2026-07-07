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
  } catch {
    tokenCidrs = "no se pudo decodificar el token";
  }

  const parts = token.split(".");
  const segLens = parts.map((p) => p.length);
  // Detecta espacios/saltos de línea invisibles pegados por error.
  const hasWhitespace = /\s/.test(token);

  return NextResponse.json({
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
  });
}
