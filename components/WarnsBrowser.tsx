"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { PlayerWarns } from "@/lib/warns";

const who = (email: string | null) => (email ? email.split("@")[0] : "alguien");
const shortDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "Europe/Madrid" }).format(
        new Date(iso),
      )
    : "";

const STATUS_CHIP: Record<string, string> = {
  vigente: "bg-banner/15 text-banner",
  caducado: "bg-surface-2 text-ink-soft",
  resuelto: "bg-grass/15 text-grass",
};

export function WarnsBrowser({ groups, threshold }: { groups: PlayerWarns[]; threshold: number }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"vigentes" | "todos">("vigentes");

  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    return groups
      .map((g) => {
        const warns = mode === "vigentes" ? g.warns.filter((w) => w.status === "vigente") : g.warns;
        return { ...g, shown: warns };
      })
      .filter((g) => {
        if (g.shown.length === 0) return false;
        if (!s) return true;
        return (
          `${g.name} ${g.tag}`.toLowerCase().includes(s) ||
          g.shown.some((w) => w.reason.toLowerCase().includes(s))
        );
      });
  }, [groups, q, mode]);

  const totalVig = groups.reduce((n, g) => n + g.vigentes, 0);

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
        <Search className="h-4 w-4 flex-none text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por jugador, tag o motivo…"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
        />
      </label>

      {/* Vigentes / Todos */}
      <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {(
          [
            { id: "vigentes", label: `Vigentes (${totalVig})` },
            { id: "todos", label: "Todos (con caducados y resueltos)" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
              mode === t.id ? "bg-gold text-banner-dark" : "text-ink-soft hover:bg-surface-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center text-sm text-ink-soft">
          {mode === "vigentes" ? "Nadie tiene warns vigentes 👌" : "Sin resultados."}
        </div>
      ) : (
        <div className="space-y-2">
          {view.map((g) => (
            <div key={g.tag} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
                <Link
                  href={`/member/${encodeURIComponent(g.tag)}`}
                  className="min-w-0 flex-1 truncate font-extrabold text-ink hover:text-gold-deep hover:underline"
                >
                  {g.name}
                </Link>
                {g.vigentes > 0 && (
                  <span
                    className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      g.vigentes >= threshold ? "bg-banner text-white" : "bg-banner/15 text-banner"
                    }`}
                  >
                    {g.vigentes} vigente{g.vigentes === 1 ? "" : "s"}
                  </span>
                )}
                {mode === "todos" && (g.caducados > 0 || g.resueltos > 0) && (
                  <span className="flex-none text-[11px] text-ink-soft">
                    {g.caducados > 0 && `${g.caducados} cad.`}
                    {g.caducados > 0 && g.resueltos > 0 && " · "}
                    {g.resueltos > 0 && `${g.resueltos} res.`}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-line">
                {g.shown.map((w) => (
                  <li key={w.id} className="px-3.5 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{w.reason}</p>
                      <span
                        className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_CHIP[w.status]}`}
                      >
                        {w.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-soft">
                      {who(w.createdBy)} · {shortDate(w.createdAt)}
                      {w.status === "resuelto" && (
                        <>
                          {" "}
                          → ✓ {who(w.resolvedBy)} · {shortDate(w.resolvedAt)}
                          {w.resolution && <> · {w.resolution}</>}
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
