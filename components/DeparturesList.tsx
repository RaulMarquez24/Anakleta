"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { MemberNote } from "@/components/MemberNote";

export interface Departure {
  tag: string;
  name: string;
  role: string | null;
  townHall: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  note: string | null;
  noteBy: string | null;
  noteAt: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

const EPHEMERAL_DAYS = 1; // 0-1 días = gente que entra y sale; no son bajas reales
const PAGE_SIZE = 15;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(
    new Date(iso),
  );
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export function DeparturesList({ departures }: { departures: Departure[] }) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showEphemeral, setShowEphemeral] = useState(false);
  const [page, setPage] = useState(0);

  const reset = () => setPage(0);

  const ephemeralCount = useMemo(
    () =>
      departures.filter((d) => {
        const s = daysBetween(d.firstSeenAt, d.lastSeenAt);
        return s != null && s <= EPHEMERAL_DAYS;
      }).length,
    [departures],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to + "T23:59:59").getTime() : null;
    return departures.filter((d) => {
      const stay = daysBetween(d.firstSeenAt, d.lastSeenAt);
      const ephemeral = stay != null && stay <= EPHEMERAL_DAYS;
      if (ephemeral && !showEphemeral) return false;
      if (q && !`${d.name} ${d.tag}`.toLowerCase().includes(q)) return false;
      if (fromMs != null || toMs != null) {
        const t = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : null;
        if (t == null) return false;
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
      }
      return true;
    });
  }, [departures, query, from, to, showEphemeral]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const hiddenNote = !showEphemeral && ephemeralCount > 0;

  return (
    <div>
      {/* Filtros */}
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
          <Search className="h-4 w-4 flex-none text-ink-soft" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
            }}
            placeholder="Buscar por nombre o tag…"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-2">
          <span className="text-[11px] font-bold text-ink-soft">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              reset();
            }}
            className="bg-transparent text-sm font-semibold text-ink outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-2">
          <span className="text-[11px] font-bold text-ink-soft">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              reset();
            }}
            className="bg-transparent text-sm font-semibold text-ink outline-none"
          />
        </label>
      </div>

      {/* Toggle efímeros + contador */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink-soft">
          {filtered.length} baja{filtered.length === 1 ? "" : "s"}
        </span>
        {ephemeralCount > 0 && (
          <button
            onClick={() => {
              setShowEphemeral((v) => !v);
              reset();
            }}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2"
          >
            {showEphemeral ? "Ocultar efímeros" : `Ver ocultos (${ephemeralCount})`}
          </button>
        )}
      </div>

      {pageRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center text-sm text-ink-soft">
          {departures.length === 0 ? "Nadie ha abandonado el clan (aún)." : "Sin resultados con esos filtros."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {pageRows.map((d) => {
              const stay = daysBetween(d.firstSeenAt, d.lastSeenAt);
              const ephemeral = stay != null && stay <= EPHEMERAL_DAYS;
              return (
                <li
                  key={d.tag}
                  className={`flex items-start gap-3 px-3.5 py-2.5 ${ephemeral ? "opacity-60" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-ink">{d.name}</span>
                    {ephemeral && (
                      <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
                        efímero
                      </span>
                    )}
                    <span className="ml-2 font-mono text-[11px] text-ink-soft">{d.tag}</span>
                    <span className="ml-2 text-xs text-ink-soft">
                      {d.role ? (ROLE_LABEL[d.role] ?? d.role) : "—"}
                      {d.townHall != null && <> · TH{d.townHall}</>}
                    </span>
                    <p className="text-xs text-ink-soft">
                      Alta {fmtDate(d.firstSeenAt)}
                      {stay != null && <> · estuvo {stay} día{stay === 1 ? "" : "s"}</>}
                    </p>
                    <MemberNote
                      tag={d.tag}
                      initialNote={d.note}
                      initialBy={d.noteBy}
                      initialAt={d.noteAt}
                      placeholder="Ej.: expulsado por inactivo / se fue solo / tóxico…"
                    />
                  </div>
                  <span className="mt-0.5 whitespace-nowrap rounded-full bg-banner/12 px-2.5 py-1 text-xs font-extrabold text-banner">
                    Se fue {fmtDate(d.lastSeenAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Paginador */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-extrabold text-ink transition hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-xs font-bold text-ink-soft">
            Página {safePage + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-extrabold text-ink transition hover:bg-surface-2 disabled:opacity-40"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {hiddenNote && (
        <p className="mt-3 text-xs text-ink-soft">
          Se ocultan {ephemeralCount} que estuvieron solo 0-1 días (entraron y se salieron). Usa
          &ldquo;Ver ocultos&rdquo; para incluirlos.
        </p>
      )}
    </div>
  );
}
