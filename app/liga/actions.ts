"use server";

import { getSeasonScoreboard, type SeasonScoreboard } from "@/lib/war-history";
import { sendClanMessage, discordConfigured } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function label(season: string): string {
  const m = season.match(/^(\d{4})-(\d{2})$/);
  if (!m) return season;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

// Construye las líneas del cuadro (monospace) para el code block de Discord.
function buildLines(sb: SeasonScoreboard): string[] {
  const rr = sb.rounds;
  const nameW = Math.min(20, Math.max(10, ...sb.rows.map((r) => r.name.length)));
  const lines: string[] = [];
  lines.push(`(${rr.map((r) => `R${r}`).join(" | ")} | ⭐ | %)`);
  sb.rows.forEach((row, i) => {
    const cells = rr.map((r) => (row.byRound[r] != null ? String(row.byRound[r]) : " ")).join(" | ");
    const idx = `${i + 1}`.padStart(2, " ");
    const name = (row.name.length > nameW ? row.name.slice(0, nameW) : row.name).padEnd(nameW, " ");
    lines.push(`${idx}. ${name} | ${cells} | ⭐${row.totalStars} ${Math.round(row.totalDestruction)}%`);
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

  const title = `Participantes CWL ${label(season)}`;
  const lines = buildLines(sb);

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
    const content = (i === 0 ? `**🏆 ${title}**\n` : "") + "```\n" + chunks[i] + "\n```";
    const ok = await sendClanMessage(content, {}, channelId);
    if (!ok) return { ok: false, error: "No se pudo enviar a Discord (revisa el bot/canal)." };
  }
  return { ok: true };
}
