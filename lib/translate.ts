// Traducción gratuita al español, sin clave. Intenta Google (mejor calidad) y,
// si falla —típico desde IPs de datacenter como Vercel/Fly—, recurre a MyMemory
// (API pensada para servidores). Si todo falla, deja el texto original.

const DELAY_MS = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Google Translate (endpoint no oficial) ---
async function gtrans(text: string, tl = "es"): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto" +
    `&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as [string, string][][];
  const out = (data[0] ?? []).map((s) => s[0]).filter(Boolean).join("");
  if (!out) throw new Error("google vacío");
  return out;
}

// --- MyMemory (respaldo; límite ~500 caracteres por petición) ---
function splitFor(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) parts.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) parts.push(cur);
  return parts;
}

async function mymemory(text: string, tl = "es"): Promise<string> {
  const out: string[] = [];
  for (const part of splitFor(text, 480)) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=en|${tl}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`mymemory ${res.status}`);
    const j = (await res.json()) as { responseStatus?: number; responseData?: { translatedText?: string } };
    const t = j.responseData?.translatedText;
    if (!t) throw new Error("mymemory vacío");
    out.push(t);
    await sleep(DELAY_MS);
  }
  return out.join(" ");
}

type State = { google: boolean };

async function translateChunk(text: string, state: State): Promise<string> {
  if (!text.trim()) return text;
  if (state.google) {
    try {
      return await gtrans(text);
    } catch {
      state.google = false; // no reintentes Google el resto del mensaje
    }
  }
  try {
    return await mymemory(text);
  } catch {
    return text;
  }
}

// Traduce una línea conservando su prefijo markdown (encabezado, viñeta, cita…).
async function translateLine(line: string, state: State): Promise<string> {
  const m = line.match(/^(\s*(?:#{1,6}\s+|[-*•]\s+|>\s+|\d+[.)]\s+)?)([\s\S]*)$/);
  const prefix = m ? m[1] : "";
  const body = m ? m[2] : line;
  if (!body.trim()) return line;
  return prefix + (await translateChunk(body, state));
}

// Traduce un bloque markdown línea a línea (preserva la estructura).
export async function translateMarkdown(text: string, tl = "es"): Promise<string> {
  void tl;
  const state: State = { google: true };
  const out: string[] = [];
  for (const line of text.split("\n")) {
    out.push(await translateLine(line, state));
    if (line.trim()) await sleep(DELAY_MS);
  }
  return out.join("\n");
}
