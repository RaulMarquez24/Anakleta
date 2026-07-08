"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { ActivityRow, ActivityCategory } from "@/lib/history";

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

type Filter = "todos" | "candidatos" | "destacados" | "nuevos";
type Sort = "kick" | "inactivo" | "ratio" | "guerra" | "nombre";

const SORTS: { key: Sort; label: string }[] = [
  { key: "kick", label: "A revisar/echar" },
  { key: "inactivo", label: "Más inactivos" },
  { key: "ratio", label: "Peor ratio donaciones" },
  { key: "guerra", label: "Más fallos en guerra" },
  { key: "nombre", label: "Nombre" },
];

function ago(days: number | null, capped: boolean): string {
  if (days == null) return "sin datos";
  if (days < 1) return "activo hoy";
  const d = Math.round(days);
  return `${d}d sin actividad${capped ? "+" : ""}`;
}

function agoShort(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return "ahora";
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function ActivityList({
  members,
  thresholdDays,
  warsInPeriod,
}: {
  members: ActivityRow[];
  thresholdDays: number;
  warsInPeriod: number;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [sort, setSort] = useState<Sort>("kick");

  const counts = useMemo(
    () => ({
      candidatos: members.filter((m) => m.category === "expulsion" || m.category === "revisar").length,
      destacados: members.filter((m) => m.category === "destacado").length,
      nuevos: members.filter((m) => m.isNew).length,
    }),
    [members],
  );

  const view = useMemo(() => {
    let arr = members.filter((m) => {
      if (filter === "candidatos") return m.category === "expulsion" || m.category === "revisar";
      if (filter === "destacados") return m.category === "destacado";
      if (filter === "nuevos") return m.isNew;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      switch (sort) {
        case "inactivo":
          return (b.staleDays ?? -1) - (a.staleDays ?? -1);
        case "ratio":
          return (a.ratio ?? Infinity) - (b.ratio ?? Infinity);
        case "guerra":
          return b.warMissed - a.warMissed || (b.staleDays ?? -1) - (a.staleDays ?? -1);
        case "nombre":
          return a.name.localeCompare(b.name, "es");
        default:
          return b.kickScore - a.kickScore || (b.staleDays ?? -1) - (a.staleDays ?? -1);
      }
    });
    return arr;
  }, [members, filter, sort]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "todos", label: `Todos (${members.length})` },
    { key: "candidatos", label: `A revisar (${counts.candidatos})` },
    { key: "destacados", label: `Destacados (${counts.destacados})` },
    { key: "nuevos", label: `Nuevos (${counts.nuevos})` },
  ];

  return (
    <>
      {/* Filtros */}
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
              filter === f.key ? "bg-banner text-white" : "bg-surface-2 text-ink-soft hover:bg-line"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orden */}
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="sort" className="text-xs font-bold text-ink-soft">Ordenar por</label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-bold text-ink"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {view.map((m) => {
          const cat = CAT[m.category];
          const susp = m.category === "expulsion" || m.category === "revisar";
          return (
            <Link
              key={m.tag}
              href={`/member/${encodeURIComponent(m.tag)}`}
              className={`block rounded-2xl border border-line bg-surface p-3.5 shadow-sm ${
                m.category === "expulsion"
                  ? "border-l-4 border-l-banner"
                  : m.category === "destacado"
                    ? "border-l-4 border-l-grass"
                    : ""
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-extrabold text-ink">{m.name}</span>
                {m.isNew && (
                  <span className="rounded-full bg-grass/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-grass">
                    Nuevo
                  </span>
                )}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-extrabold ${cat.cls}`}>
                  {cat.label}
                </span>
              </div>

              <p className={`mb-2 text-sm font-bold ${susp && m.staleDays != null && m.staleDays >= thresholdDays ? "text-banner" : "text-ink-soft"}`}>
                {ago(m.staleDays, m.capped)}
                <span className="font-normal"> · {m.role ? (ROLE_LABEL[m.role] ?? m.role) : "—"}</span>
              </p>

              {/* Métricas */}
              <div className="mb-2 flex flex-wrap gap-1.5 text-xs font-bold">
                <span className={`rounded-lg px-2 py-1 ${m.ratio != null && m.ratio < 1 ? "bg-banner/12 text-banner" : "bg-surface-2 text-ink"}`}>
                  🎁 {m.donations ?? "—"} · ratio {m.ratio == null ? "—" : m.ratio.toFixed(1)}
                </span>
                {warsInPeriod > 0 && (
                  <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">
                    ⚔️ {m.warsPlayed} guerras · ⭐ {m.warStars}
                  </span>
                )}
                {m.warMissed > 0 && (
                  <span className="rounded-lg bg-banner/12 px-2 py-1 text-banner">
                    {m.warMissed} sin atacar
                  </span>
                )}
              </div>

              {/* Señales recientes */}
              {m.recent.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.recent.map((s) => (
                    <span
                      key={s.key}
                      title={new Date(s.at).toLocaleString("es-ES")}
                      className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink-soft"
                    >
                      <span aria-hidden>{s.icon}</span>
                      {s.label}
                      <span className="text-ink-soft/70">· {agoShort(s.at)}</span>
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
