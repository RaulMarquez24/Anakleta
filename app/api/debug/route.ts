import { NextResponse } from "next/server";

// ENDPOINT DE DIAGNÓSTICO TEMPORAL — se elimina en cuanto validemos producción.
// No expone secretos: solo la base URL (config) y la IP whitelisteada del token
// (que va dentro del propio JWT como claim de configuración, no es material secreto).
export async function GET() {
  const baseUrl = process.env.COC_API_BASE_URL ?? null;
  const token = process.env.COC_API_TOKEN ?? "";

  let tokenCidrs: unknown = null;
  let tokenLen = token.length;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    const clientLimit = (payload.limits ?? []).find(
      (l: { type?: string }) => l?.type === "client",
    );
    tokenCidrs = clientLimit?.cidrs ?? null;
  } catch {
    tokenCidrs = "no se pudo decodificar el token";
  }

  return NextResponse.json({
    base_url: baseUrl,
    token_present: token.length > 0,
    token_len: tokenLen,
    token_cidrs: tokenCidrs,
  });
}
