import type { WarSummary } from "@/lib/war-history";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-07-01" / "2026-07" -> "Julio 2026"
export function seasonLabel(season: string | null): string {
  if (!season) return "Temporada";
  const m = season.match(/^(\d{4})-(\d{2})/);
  if (!m) return season;
  const mes = MESES[Number(m[2]) - 1] ?? "";
  const cap = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${cap} ${m[1]}`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(
    new Date(iso),
  );
}

export function ResultBadge({ war }: { war: WarSummary }) {
  if (war.state && war.state !== "warEnded") {
    return (
      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-extrabold text-gold-deep">
        {war.state === "inWar" ? "En guerra" : "Preparación"}
      </span>
    );
  }
  const map: Record<string, { t: string; cls: string }> = {
    win: { t: "Victoria", cls: "bg-grass/15 text-grass" },
    lose: { t: "Derrota", cls: "bg-banner/15 text-banner" },
    tie: { t: "Empate", cls: "bg-surface-2 text-ink-soft" },
  };
  const r = war.result ? map[war.result] : null;
  if (!r) return <span className="text-[11px] font-bold text-ink-soft">—</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${r.cls}`}>{r.t}</span>;
}

// "⭐ 54 – 57"
export function scoreText(war: WarSummary): string {
  return `⭐ ${war.clanStars ?? "—"} – ${war.opponentStars ?? "—"}`;
}
