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

// Los emojis descuadran la tabla: en monospace miden ~2 columnas (y los
// compuestos con ZWJ aún más), pero .length no lo refleja. Los quitamos para
// alinear por texto plano; su ancho real además varía según la plataforma.
function cleanName(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}/gu, "") // emojis
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "") // banderas (indicadores regionales)
    .replace(/[︀-️‍⃣]/gu, "") // selectores de variacion, ZWJ, keycap
    .replace(/\s+/g, " ")
    .trim();
}

// Construye el cuadro monospace (alineado) para el code block de Discord.
function buildTable(sb: SeasonScoreboard): string[] {
  const rr = sb.rounds;
  const names = sb.rows.map((r) => cleanName(r.name) || "jugador");
  const nameW = Math.min(16, Math.max(8, ...names.map((n) => n.length)));
  const cellsH = rr.map((r) => `R${r}`.padStart(2)).join(" ");
  const head = `${"#".padStart(2)} ${"Jugador".padEnd(nameW)} ${cellsH} ${"Est".padStart(3)} ${"%".padStart(4)}`;
  const lines = [head, "─".repeat(head.length)];
  sb.rows.forEach((row, i) => {
    const idx = `${i + 1}`.padStart(2);
    const nm = names[i];
    const name = (nm.length > nameW ? nm.slice(0, nameW) : nm).padEnd(nameW);
    const cells = rr
      .map((r) => (row.byRound[r] != null ? String(row.byRound[r]) : "·").padStart(2))
      .join(" ");
    const tot = String(row.totalStars).padStart(3);
    const pct = String(Math.round(row.totalDestruction)).padStart(4);
    lines.push(`${idx} ${name} ${cells} ${tot} ${pct}`);
  });
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

  const title = `**🏆 Participación CWL · ${label(season)}${suffix}**`;
  const totalStars = sb.rows.reduce((n, r) => n + r.totalStars, 0);
  const footer = `⭐ **${totalStars}** estrellas del clan · **${sb.rows.length}** participantes`;
  const lines = buildTable(sb);

  // Trocear en code blocks bajo el límite de Discord (~2000 chars).
  const chunks: string[] = [];
  let buf: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length + 1 > 1700 && buf.length) {
      chunks.push(buf.join("\n"));
      buf = [];
      len = 0;
    }
    buf.push(l);
    len += l.length + 1;
  }
  if (buf.length) chunks.push(buf.join("\n"));

  for (let i = 0; i < chunks.length; i++) {
    const first = i === 0 ? `${title}\n` : "";
    const last = i === chunks.length - 1 ? `\n${footer}` : "";
    const content = `${first}\`\`\`\n${chunks[i]}\n\`\`\`${last}`;
    const ok = await sendClanMessage(content, {}, channelId);
    if (!ok) return { ok: false, error: "No se pudo enviar a Discord (revisa el bot/canal)." };
  }
  return { ok: true };
}
