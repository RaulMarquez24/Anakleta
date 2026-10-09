// Traducción gratuita al español, sin clave (endpoint no oficial de Google
// Translate). Mismo criterio que bot/translate.js. Si falla, deja el original.

const DELAY_MS = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gtrans(text: string, tl = "es"): Promise<string> {
  if (!text.trim()) return text;
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto" +
    `&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
  const data = (await res.json()) as [string, string][][];
  return (data[0] ?? []).map((s) => s[0]).filter(Boolean).join("");
}

// Traduce una línea conservando su prefijo markdown (encabezado, viñeta, cita…).
async function translateLine(line: string): Promise<string> {
  const m = line.match(/^(\s*(?:#{1,6}\s+|[-*•]\s+|>\s+|\d+[.)]\s+)?)([\s\S]*)$/);
  const prefix = m ? m[1] : "";
  const body = m ? m[2] : line;
  if (!body.trim()) return line;
  try {
    return prefix + (await gtrans(body));
  } catch {
    return line;
  }
}

// Traduce un bloque markdown línea a línea (preserva la estructura).
export async function translateMarkdown(text: string, tl = "es"): Promise<string> {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    out.push(await translateLine(line));
    if (line.trim()) await sleep(DELAY_MS);
  }
  return out.join("\n");
}
