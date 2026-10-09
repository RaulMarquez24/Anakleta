// Traducción gratuita al español, sin clave: endpoint no oficial de Google
// Translate. Para los pocos mensajes de actualización al mes va sobrado. Si
// falla (rate limit, cambio de API), se devuelve el texto original sin romper.

const DELAY_MS = 120; // pequeño respiro entre líneas para no abusar

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gtrans(text, tl = "es") {
  if (!text.trim()) return text;
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto" +
    `&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
  const data = await res.json();
  // data[0] = [[traducido, original, ...], ...]
  return (data[0] ?? []).map((s) => s[0]).filter(Boolean).join("");
}

// Traduce una línea conservando su prefijo markdown (encabezado, viñeta, cita,
// numeración). Google mantiene las URLs tal cual, así que no las tocamos.
async function translateLine(line) {
  const m = line.match(/^(\s*(?:#{1,6}\s+|[-*•]\s+|>\s+|\d+[.)]\s+)?)([\s\S]*)$/);
  const prefix = m ? m[1] : "";
  const body = m ? m[2] : line;
  if (!body.trim()) return line; // líneas vacías / solo símbolos
  try {
    return prefix + (await gtrans(body));
  } catch {
    return line; // si falla, deja el original
  }
}

// Traduce un bloque markdown línea a línea (preserva la estructura).
export async function translateMarkdown(text, tl = "es") {
  const lines = text.split("\n");
  const out = [];
  for (const line of lines) {
    out.push(await translateLine(line));
    if (line.trim()) await sleep(DELAY_MS);
  }
  return out.join("\n");
}
