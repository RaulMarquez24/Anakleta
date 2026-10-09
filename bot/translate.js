// Traducción gratuita al español, sin clave. Intenta Google (mejor calidad) y,
// si falla —típico desde IPs de datacenter como Fly—, recurre a MyMemory. Si
// todo falla, deja el texto original. Debe coincidir con lib/translate.ts.

const DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gtrans(text, tl = "es") {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto" +
    `&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = await res.json();
  const out = (data[0] ?? []).map((s) => s[0]).filter(Boolean).join("");
  if (!out) throw new Error("google vacío");
  return out;
}

function splitFor(text, max) {
  if (text.length <= max) return [text];
  const parts = [];
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

async function mymemory(text, tl = "es") {
  const out = [];
  for (const part of splitFor(text, 480)) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=en|${tl}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`mymemory ${res.status}`);
    const j = await res.json();
    const t = j.responseData?.translatedText;
    if (!t) throw new Error("mymemory vacío");
    out.push(t);
    await sleep(DELAY_MS);
  }
  return out.join(" ");
}

async function translateChunk(text, state) {
  if (!text.trim()) return text;
  if (state.google) {
    try {
      return await gtrans(text);
    } catch {
      state.google = false;
    }
  }
  try {
    return await mymemory(text);
  } catch {
    return text;
  }
}

async function translateLine(line, state) {
  const m = line.match(/^(\s*(?:#{1,6}\s+|[-*•]\s+|>\s+|\d+[.)]\s+)?)([\s\S]*)$/);
  const prefix = m ? m[1] : "";
  const body = m ? m[2] : line;
  if (!body.trim()) return line;
  return prefix + (await translateChunk(body, state));
}

export async function translateMarkdown(text) {
  const state = { google: true };
  const out = [];
  for (const line of text.split("\n")) {
    out.push(await translateLine(line, state));
    if (line.trim()) await sleep(DELAY_MS);
  }
  return out.join("\n");
}
