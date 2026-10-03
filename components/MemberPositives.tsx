"use client";

import { useState } from "react";
import { addPositive, removePositive } from "@/app/miembros/actions";
import { POSITIVE_PRESETS, POSITIVE_WEIGHTS, pointsFor } from "@/lib/positive-presets";

export interface PositiveItem {
  id: number;
  reason: string;
  points: number;
  createdBy: string | null;
  createdAt: string;
  vigente: boolean;
}

const who = (email: string | null) => (email ? email.split("@")[0] : "alguien");
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "Europe/Madrid" }).format(
    new Date(iso),
  );

// Positivos (méritos): lo contrario de un warn. Solo suman participación.
export function MemberPositives({
  tag,
  base,
  days,
  initial,
}: {
  tag: string;
  base: number; // puntos de un positivo normal (normas)
  days: number; // cuánto tiempo cuenta (0 = siempre)
  initial: PositiveItem[];
}) {
  const [items, setItems] = useState<PositiveItem[]>(initial);
  const [draft, setDraft] = useState("");
  const [peso, setPeso] = useState<string>("normal");
  const [busy, setBusy] = useState(false);

  const factor = POSITIVE_WEIGHTS.find((w) => w.key === peso)?.factor ?? 1;
  const puntos = pointsFor(base, factor);
  const vigentes = items.filter((p) => p.vigente);
  const total = vigentes.reduce((n, p) => n + p.points, 0);

  async function add() {
    const reason = draft.trim();
    if (!reason || busy) return;
    setBusy(true);
    const r = await addPositive(tag, reason, puntos);
    setBusy(false);
    if (!r.ok || !r.positive) return;
    setItems((l) => [{ ...r.positive!, vigente: true }, ...l]);
    setDraft("");
    setPeso("normal");
  }

  async function quitar(id: number) {
    if (busy) return;
    setBusy(true);
    const r = await removePositive(id);
    setBusy(false);
    if (r.ok) setItems((l) => l.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-3">
      {vigentes.length > 0 && (
        <p className="rounded-xl border border-gold/40 bg-gold/5 px-3 py-2 text-xs font-bold text-ink">
          {vigentes.length} positivo{vigentes.length === 1 ? "" : "s"} en cuenta ·{" "}
          <span className="text-gold">+{total} puntos</span> de participación
        </p>
      )}

      {/* Anotar */}
      <div className="rounded-xl border border-line p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {POSITIVE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setDraft(p)}
              className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-ink-soft transition hover:border-gold hover:text-gold"
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Qué hizo (p. ej. se quedó a rematar la guerra)"
          maxLength={300}
          className="mb-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-line">
            {POSITIVE_WEIGHTS.map((w) => (
              <button
                key={w.key}
                onClick={() => setPeso(w.key)}
                className={`px-2.5 py-1 text-[11px] font-extrabold transition ${
                  peso === w.key ? "bg-gold text-banner-dark" : "text-ink-soft hover:bg-surface-2"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-bold text-ink-soft">+{puntos} puntos</span>
          <button
            onClick={add}
            disabled={busy || !draft.trim()}
            className="ml-auto rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? "…" : "Anotar positivo"}
          </button>
        </div>
      </div>

      {/* Historial */}
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-soft">
          Nada anotado todavía. Sirve para dejar constancia de lo que hace bien y que cuente para
          subir de rango.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((p) => (
            <li
              key={p.id}
              className={`flex items-start gap-2 rounded-xl border border-line p-2.5 ${p.vigente ? "bg-surface-2/40" : "opacity-60"}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{p.reason}</span>
                <span className="block text-[11px] text-ink-soft">
                  {who(p.createdBy)} · {shortDate(p.createdAt)} ·{" "}
                  <strong className={p.vigente ? "text-gold" : ""}>+{p.points}</strong>
                  {!p.vigente && (
                    <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 font-bold">
                      ya no cuenta
                    </span>
                  )}
                </span>
              </span>
              <button
                onClick={() => quitar(p.id)}
                disabled={busy}
                title="Quitar (se anotó por error)"
                className="flex-none rounded-full px-2 py-1 text-xs font-bold text-ink-soft transition hover:bg-surface-2 hover:text-banner disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-ink-soft">
        Un positivo suma {base} puntos (la mitad si es un detalle, el doble si es grande) y cuenta
        {days > 0 ? ` durante ${days} días` : " siempre"}. Nunca resta a quien no tiene ninguno.
      </p>
    </div>
  );
}
