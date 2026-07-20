"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { ActivityRow, ActivityCategory, ActivityPeriod } from "@/lib/history";

const CAT: Record<ActivityCategory, { label: string; cls: string }> = {
  expulsion: { label: "🔴 Expulsión", cls: "bg-banner/15 text-banner" },
  revisar: { label: "🟡 Revisar", cls: "bg-gold/25 text-gold-deep" },
  destacado: { label: "🟢 Destacado", cls: "bg-grass/15 text-grass" },
  ok: { label: "OK", cls: "bg-surface-2 text-ink-soft" },
  mando: { label: "Mando", cls: "bg-sky/15 text-sky" },
};

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

type Filter = "todos" | "expulsar" | "pendiente" | "destacables";
export type Sort = "participacion" | "donaciones" | "inactivo" | "guerra" | "nombre";

// El orden es solo por métricas; el agrupado (expulsar/revisar/destacables) lo
// hacen los tabs de arriba.
const SORTS: { key: Sort; label: string }[] = [
  { key: "participacion", label: "Más participativos" },
  { key: "donaciones", label: "Más donan" },
  { key: "inactivo", label: "Más inactivos" },
  { key: "guerra", label: "Más fallos en guerra" },
  { key: "nombre", label: "Nombre" },
];

function shortTier(name: string | null): string {
  return name ? name.replace(" League", "") : "Sin rango";
}

const LEAGUE_VS: Record<string, { label: string; cls: string }> = {
  muy_alta: { label: "▲▲ liga alta p/ TH", cls: "bg-grass/15 text-grass" },
  alta: { label: "▲ liga alta p/ TH", cls: "bg-grass/15 text-grass" },
  normal: { label: "liga OK p/ TH", cls: "bg-surface-2 text-ink-soft" },
  baja: { label: "▼ liga baja p/ TH", cls: "bg-gold/20 text-gold-deep" },
  muy_baja: { label: "▼▼ liga baja p/ TH", cls: "bg-banner/12 text-banner" },
};

function ago(days: number | null, capped: boolean): string {
  if (days == null) return "sin datos";
  if (days < 1) return "activo hoy";
  const d = Math.round(days);
  return `${d}d sin actividad${capped ? "+" : ""}`;
}

// Tono de un flag según su gravedad (para colorear los chips).
function flagTone(f: string): string {
  if (/robó|No juega|No dona|warn/i.test(f)) return "bg-banner/12 text-banner";
  if (/capital|desactivada|competitivo/i.test(f)) return "bg-gold/15 text-gold-deep";
  return "bg-surface-2 text-ink-soft";
}

// Celda de "vital": etiqueta pequeña + valor, con color de estado opcional.
function Vital({
  label,
  tone = "ok",
  children,
}: {
  label: string;
  tone?: "ok" | "warn" | "bad" | "good";
  children: React.ReactNode;
}) {
  const valCls = {
    ok: "text-ink",
    good: "text-grass",
    warn: "text-gold-deep",
    bad: "text-banner",
  }[tone];
  return (
    <div className="rounded-xl bg-surface-2/60 px-2.5 py-1.5">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`mt-0.5 text-xs font-extrabold ${valCls}`}>{children}</p>
    </div>
  );
}

const PERIODS: { key: ActivityPeriod; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "todo", label: "Todo" },
];

export function ActivityList({
  members,
  thresholdDays,
  warsInPeriod,
  defaultSort,
  period,
}: {
  members: ActivityRow[];
  thresholdDays: number;
  warsInPeriod: number;
  defaultSort: Sort;
  period: ActivityPeriod;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [q, setQ] = useState("");

  const counts = useMemo(
    () => ({
      expulsar: members.filter((m) => m.category === "expulsion").length,
      pendiente: members.filter((m) => m.category === "revisar").length,
      destacables: members.filter((m) => m.category === "destacado").length,
    }),
    [members],
  );

  const view = useMemo(() => {
    let arr = members.filter((m) => {
      if (filter === "expulsar") return m.category === "expulsion";
      if (filter === "pendiente") return m.category === "revisar";
      if (filter === "destacables") return m.category === "destacado";
      return true;
    });
    arr = [...arr].sort((a, b) => {
      switch (sort) {
        case "donaciones":
          return (b.donations ?? -1) - (a.donations ?? -1);
        case "inactivo":
          return (b.staleDays ?? -1) - (a.staleDays ?? -1);
        case "guerra":
          return (
            b.warMissed + b.warStolen - (a.warMissed + a.warStolen) ||
            (b.staleDays ?? -1) - (a.staleDays ?? -1)
          );
        case "nombre":
          return a.name.localeCompare(b.name, "es");
        default:
          return b.participationScore - a.participationScore;
      }
    });
    return arr;
  }, [members, filter, sort]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? view.filter((m) => `${m.name} ${m.tag}`.toLowerCase().includes(s)) : view;
  }, [view, q]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: members.length },
    { key: "expulsar", label: "Expulsar", count: counts.expulsar },
    { key: "pendiente", label: "Pendiente", count: counts.pendiente },
    { key: "destacables", label: "Destac.", count: counts.destacables },
  ];

  return (
    <>
      {/* Buscador (nombre o tag) */}
      <label className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
        <Search className="h-4 w-4 flex-none text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o tag…"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
        />
        {q && <span className="flex-none text-[11px] font-bold text-ink-soft">{shown.length}</span>}
      </label>

      {/* Periodo + Orden (desplegables) */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5">
          <span className="text-[11px] font-bold text-ink-soft">Periodo</span>
          <select
            value={period}
            onChange={(e) => router.push(`/actividad?p=${e.target.value}`)}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none"
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5">
          <span className="text-[11px] font-bold text-ink-soft">Orden</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Filtros: control segmentado de 4 columnas */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl px-1 py-1.5 text-center transition ${
              filter === f.key ? "bg-banner text-white" : "bg-surface-2 text-ink-soft hover:bg-line"
            }`}
          >
            <span className="block text-[10px] font-bold leading-tight">{f.label}</span>
            <span className="block text-base font-extrabold leading-tight">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {shown.map((m) => {
          const cat = CAT[m.category];
          const susp = m.category === "expulsion" || m.category === "revisar";
          const stale = susp && m.staleDays != null && m.staleDays >= thresholdDays;
          const roundsAttacked = Math.min(m.warAttacks, m.warsPlayed);
          const warTone =
            m.warStolen > 0 || m.warMissed > 0
              ? "bad"
              : m.warsPlayed > 0 && roundsAttacked === m.warsPlayed
                ? "good"
                : "ok";
          const capMissed = m.capitalWeekends - m.capitalParticipated;
          const actTone =
            m.staleDays == null ? "ok" : stale ? "bad" : m.staleDays < 1 ? "good" : "ok";
          const edge =
            m.category === "expulsion"
              ? "border-l-4 border-l-banner"
              : m.category === "revisar"
                ? "border-l-4 border-l-gold"
                : m.category === "destacado"
                  ? "border-l-4 border-l-grass"
                  : "";
          return (
            <Link
              key={m.tag}
              href={`/member/${encodeURIComponent(m.tag)}`}
              className={`block rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition hover:bg-surface-2/40 ${edge}`}
            >
              {/* Cabecera: TH + nombre + estado */}
              <div className="mb-2 flex items-center gap-2">
                <span className="flex-none rounded-lg bg-sky/15 px-1.5 py-0.5 text-[11px] font-extrabold text-sky">
                  TH{m.townHall ?? "—"}
                </span>
                <span className="truncate font-extrabold text-ink">{m.name}</span>
                {m.isNew && (
                  <span className="flex-none rounded-full bg-grass/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-grass">
                    Nuevo
                  </span>
                )}
                <span className={`ml-auto flex-none rounded-full px-2 py-0.5 text-[11px] font-extrabold ${cat.cls}`}>
                  {cat.label}
                </span>
              </div>

              {/* Rango + liga-vs-TH */}
              <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-ink">
                  {m.leagueTierIcon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.leagueTierIcon} alt="" width={16} height={16} className="h-4 w-4" loading="lazy" />
                  )}
                  {shortTier(m.leagueTierName)}
                </span>
                {m.leagueVsTh && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${LEAGUE_VS[m.leagueVsTh].cls}`}>
                    {LEAGUE_VS[m.leagueVsTh].label}
                  </span>
                )}
              </div>

              {/* Vitales: guerra · donaciones · capital · actividad */}
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                <Vital label="Guerra" tone={warsInPeriod > 0 ? warTone : "ok"}>
                  {warsInPeriod > 0 ? (
                    <>
                      {roundsAttacked}/{m.warsPlayed} · ⭐{m.warStars}
                      {m.warStolen > 0 && (
                        <span className="text-banner"> · {m.warStolen} robó</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </Vital>
                <Vital label="Donaciones" tone={m.donationNegative ? "bad" : "ok"}>
                  🎁{m.donations ?? "—"}
                  {m.donationsTrend === "up" && <span className="text-grass">↑</span>}
                  {m.donationsTrend === "down" && <span className="text-banner">↓</span>}
                  {" · "}📥{m.donationsReceived ?? "—"}
                </Vital>
                <Vital
                  label="Capital"
                  tone={m.capitalWeekends === 0 ? "ok" : capMissed > 0 ? "warn" : "good"}
                >
                  {m.capitalWeekends > 0 ? `${m.capitalParticipated}/${m.capitalWeekends} findes` : "—"}
                </Vital>
                <Vital label="Actividad" tone={actTone}>
                  {ago(m.staleDays, m.capped)}
                </Vital>
              </div>

              {/* Faltillas */}
              {m.flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.flags.map((f) => (
                    <span key={f} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${flagTone(f)}`}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
