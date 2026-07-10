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

// Colores ANSI para el code block ```ansi``` de Discord. Se usa ansi (no md)
// porque md interpreta "_" y "*" de los nombres como cursiva/negrita y descuadra
// filas enteras; ansi los deja intactos y encima permite color por estado.
const ESC = "\x1b";
const paint = (code: string, s: string) => `${ESC}[${code}m${s}${ESC}[0m`;
const DIM = "30"; // gris (separadores, índice, "no jugaba")
const RED = "1;31"; // rojo (no atacó)
const GREEN = "32"; // 3 estrellas
const YELLOW = "33"; // 1-2 estrellas
const CYAN = "36"; // %
const GOLD = "1;33"; // título / totales
const HEAD = "1;36"; // cabecera en negrita

const MISS = "X"; // alineado pero NO atacó (ASCII: ancho fijo garantizado)
const BENCH = "·"; // no estaba alineado ese día

// Celda de 2 columnas (" 3", " X", " ·") ya coloreada según el estado.
function cellField(c: { stars: number; attacked: boolean } | undefined): string {
  if (!c) return paint(DIM, ` ${BENCH}`); // no jugaba
  if (!c.attacked) return paint(RED, ` ${MISS}`); // alineado y no atacó
  const col = c.stars >= 3 ? GREEN : c.stars === 0 ? RED : YELLOW;
  return paint(col, ` ${c.stars}`); // atacó (0-3 estrellas)
}

// Construye el contenido (líneas) del resumen para un code block ```ansi```.
// El título, la cabecera de columnas y el resumen van DENTRO del bloque.
function buildLines(sb: SeasonScoreboard, title: string): string[] {
  const rr = sb.rounds;
  const ranked = sb.rows; // ya viene ordenado por estrellas desc, luego % desc
  const played = ranked.filter((r) => r.attacksTotal > 0);
  const idle = ranked.filter((r) => r.attacksTotal === 0); // no atacaron ni una vez

  const nameByTag = new Map(ranked.map((r) => [r.tag, cleanName(r.name) || "jugador"]));
  const nameW = Math.min(16, Math.max(8, ...[...nameByTag.values()].map((n) => n.length)));

  const bar = paint(DIM, "|");
  // Región de rondas: "R1 R2 ... R7". Coincide en columnas con las celdas " N".
  const roundsHdr = rr.map((r) => `R${r}`).join(" ");

  let n = 0;
  const rowLine = (row: (typeof ranked)[number]): string => {
    n++;
    const idx = paint(DIM, `${n}.`.padStart(3));
    const name = (nameByTag.get(row.tag) ?? "jugador").padEnd(nameW);
    const cells = rr.map((r) => cellField(row.byRound[r])).join(" ");
    const stars = paint(GOLD, String(row.totalStars).padStart(3));
    const pct = paint(CYAN, `${String(Math.round(row.totalDestruction)).padStart(3)}%`);
    // idx(3) · name(nameW) · |cells · | · ⭐ stars(3) pct(4)
    return `${idx} ${name} ${bar}${cells} ${bar} ${paint(YELLOW, "⭐")} ${stars} ${pct}`;
  };

  // Cabecera alineada con las filas (mismos anchos de columna).
  const headTxt = `  # ${"Jugador".padEnd(nameW)} |${roundsHdr} | ⭐ Est    %`;
  const rule = paint(DIM, "─".repeat(headTxt.length));
  const legend =
    `${paint(GREEN, "0-3")} = estrellas    ${paint(RED, MISS)} = no atacó    ` +
    `${paint(DIM, BENCH)} = no jugaba`;

  const totalStars = ranked.reduce((acc, r) => acc + r.totalStars, 0);
  const lines: string[] = [];
  lines.push(paint(GOLD, `🏆 ${title}`));
  lines.push(legend);
  lines.push("");
  lines.push(paint(HEAD, headTxt));
  lines.push(rule);
  lines.push(paint(HEAD, `Participantes (${played.length})`));
  for (const row of played) lines.push(rowLine(row));
  if (idle.length) {
    lines.push("");
    lines.push(paint(HEAD, `Sin atacar (${idle.length})`));
    for (const row of idle) lines.push(rowLine(row));
  }
  lines.push(rule);
  lines.push(
    paint(GOLD, `⭐ ${totalStars} estrellas del clan`) +
      paint(DIM, "  ·  ") +
      `${ranked.length} en alineación`,
  );
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

  // Trocear en code blocks ```ansi``` bajo el límite de Discord (~2000 chars).
  // Los códigos de color inflan la longitud, así que cortamos con margen.
  const chunks: string[] = [];
  let buf: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length + 1 > 1500 && buf.length) {
      chunks.push(buf.join("\n"));
      buf = [];
      len = 0;
    }
    buf.push(l);
    len += l.length + 1;
  }
  if (buf.length) chunks.push(buf.join("\n"));

  for (const chunk of chunks) {
    const content = `\`\`\`ansi\n${chunk}\n\`\`\``;
    const ok = await sendClanMessage(content, {}, channelId);
    if (!ok) return { ok: false, error: "No se pudo enviar a Discord (revisa el bot/canal)." };
  }
  return { ok: true };
}
