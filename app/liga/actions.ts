"use server";

import { getSeasonScoreboard, getCwlSeasons, type SeasonScoreboard } from "@/lib/war-history";
import { sendClanMessage, discordConfigured } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function label(season: string): string {
  const m = season.match(/^(\d{4})-(\d{2})/); // prefijo: soporta "2026-06" o "2026-06-01…"
  if (!m) return season;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

// Los emojis y los caracteres asiáticos (CJK) NO ocupan un ancho fijo en la
// tabla monospace de Discord, así que descuadran las columnas. Como el nombre
// va a la izquierda y no hay forma exacta de medirlos, los eliminamos: dejamos
// solo caracteres de ancho 1 (letras latinas, números y puntuación). Así
// alinear por número de caracteres vuelve a ser exacto.
const graphemeSeg = new Intl.Segmenter("es", { granularity: "grapheme" });

function isWide(g: string): boolean {
  if (/\p{Extended_Pictographic}/u.test(g) || /[\u{1F1E6}-\u{1F1FF}]/u.test(g)) return true; // emoji/banderas
  const cp = g.codePointAt(0) ?? 0;
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // jamo hangul
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK y radicales
    (cp >= 0xac00 && cp <= 0xd7a3) || // sílabas hangul
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) || // fullwidth
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x3000 && cp <= 0x303f) // signos CJK
  );
}

// Normaliza tildes (NFC: "e"+acento -> "é", 1 solo carácter) y quita todo lo que
// no mida 1 columna: emojis, banderas, CJK/fullwidth y marcas sueltas.
function cleanName(s: string): string {
  let out = "";
  for (const { segment } of graphemeSeg.segment(s.normalize("NFC"))) {
    if (isWide(segment) || /^\p{M}/u.test(segment)) continue;
    out += segment;
  }
  return out.replace(/\s+/g, " ").trim();
}

// Estado de cada ronda para un miembro (celda de la tabla).
const BENCH = "·"; // no estaba alineado ese día (no jugaba)
const MISS = "✗"; // alineado pero NO atacó (falta)

// Construye el contenido (líneas de texto) del resumen. Va todo dentro de un
// code block ```md```, que Discord colorea (cabeceras, numeración, citas), así
// no se ve monótono. El título y el resumen de estrellas van DENTRO del bloque.
function buildLines(sb: SeasonScoreboard, title: string): string[] {
  const rr = sb.rounds;
  const ranked = sb.rows; // ya viene ordenado por estrellas desc, luego % desc
  const played = ranked.filter((r) => r.attacksTotal > 0);
  const idle = ranked.filter((r) => r.attacksTotal === 0); // no atacaron ni una vez

  const nameByTag = new Map(ranked.map((r) => [r.tag, cleanName(r.name) || "jugador"]));
  const nameW = Math.min(16, Math.max(8, ...[...nameByTag.values()].map((n) => n.length)));

  const cell = (row: (typeof ranked)[number], r: number): string => {
    const c = row.byRound[r];
    if (!c) return BENCH; // sin fila esa ronda = no jugaba
    if (!c.attacked) return MISS; // alineado y no atacó
    return String(c.stars); // atacó (0-3 estrellas)
  };

  let n = 0;
  const rowLine = (row: (typeof ranked)[number]): string => {
    n++;
    const idx = `${n}.`.padStart(3);
    const name = (nameByTag.get(row.tag) ?? "jugador").padEnd(nameW);
    const cells = rr.map((r) => cell(row, r)).join(" ");
    const stars = String(row.totalStars).padStart(2);
    const pct = String(Math.round(row.totalDestruction)).padStart(3);
    return `${idx} ${name} | ${cells} | ⭐ ${stars} · ${pct}%`;
  };

  const totalStars = ranked.reduce((acc, r) => acc + r.totalStars, 0);
  const lines: string[] = [];
  lines.push(`## 🏆 ${title}`);
  lines.push(`> Ronda 1-${rr.length}   ·   [0-3]=estrellas   ·   ${MISS}=no atacó   ·   ${BENCH}=no jugaba`);
  lines.push("");
  lines.push(`# Participantes (${played.length})`);
  for (const row of played) lines.push(rowLine(row));
  if (idle.length) {
    lines.push("");
    lines.push(`# Sin atacar (${idle.length})`);
    for (const row of idle) lines.push(rowLine(row));
  }
  lines.push("");
  lines.push(`# ⭐ ${totalStars} estrellas del clan · ${ranked.length} en alineación`);
  return lines;
}

// Publica el resumen de participación de una temporada de CWL en un canal.
export async function sendSeasonSummary(
  season: string,
  channelId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!discordConfigured) return { ok: false, error: "Discord no está configurado." };

  const sb = await getSeasonScoreboard(season);
  if (sb.rows.length === 0) return { ok: false, error: "No hay datos guardados de esa temporada." };

  // Si hay dos CWL el mismo mes (p. ej. un evento como el Mundial), distínguelo.
  let suffix = "";
  try {
    const all = await getCwlSeasons();
    const monthKey = (s: string) => s.slice(0, 7);
    const sameMonth = all
      .filter((s) => monthKey(s.season) === monthKey(season))
      .sort((a, b) => (a.from ?? "").localeCompare(b.from ?? "")); // el más antiguo = CWL normal
    if (sameMonth.length > 1) {
      const idx = sameMonth.findIndex((s) => s.season === season);
      if (idx > 0) suffix = sameMonth.length === 2 ? " · Evento" : ` · Evento ${idx}`;
    }
  } catch {
    /* si falla, sin sufijo */
  }

  const lines = buildLines(sb, `Participación CWL · ${label(season)}${suffix}`);

  // Trocear en code blocks ```md``` bajo el límite de Discord (~2000 chars).
  const chunks: string[] = [];
  let buf: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length + 1 > 1850 && buf.length) {
      chunks.push(buf.join("\n"));
      buf = [];
      len = 0;
    }
    buf.push(l);
    len += l.length + 1;
  }
  if (buf.length) chunks.push(buf.join("\n"));

  for (const chunk of chunks) {
    const content = `\`\`\`md\n${chunk}\n\`\`\``;
    const ok = await sendClanMessage(content, {}, channelId);
    if (!ok) return { ok: false, error: "No se pudo enviar a Discord (revisa el bot/canal)." };
  }
  return { ok: true };
}
