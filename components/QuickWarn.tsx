"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { addWarn } from "@/app/miembros/actions";
import { WARN_PRESETS } from "@/lib/warn-presets";

// Menú de acciones (⋮) de una fila del listado. Va dentro de tarjetas <Link>,
// así que corta la propagación para no navegar. Hoy solo "poner warn".
export function QuickWarn({ tag, name }: { tag: string; name: string }) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  async function submit(e: React.SyntheticEvent) {
    stop(e);
    if (!reason.trim() || busy) return;
    setBusy(true);
    const r = await addWarn(tag, reason);
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setReason("");
      setTimeout(() => {
        setModal(false);
        setDone(false);
      }, 1000);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setMenu((m) => !m);
        }}
        title="Acciones"
        aria-label={`Acciones de ${name}`}
        className="flex-none rounded-full p-1 text-ink-soft transition hover:bg-surface-2"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* Menú */}
      {menu && (
        <>
          <span
            onClick={(e) => {
              stop(e);
              setMenu(false);
            }}
            className="fixed inset-0 z-40"
          />
          <div className="absolute right-0 top-7 z-50 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setMenu(false);
                setModal(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-ink hover:bg-surface-2"
            >
              ⚠️ Poner warn
            </button>
          </div>
        </>
      )}

      {/* Modal de warn */}
      {modal && (
        <div
          onClick={(e) => {
            stop(e);
            setModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={stop}
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-xl"
          >
            <p className="mb-2 font-extrabold text-ink">⚠️ Warn a {name}</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
              autoFocus
              placeholder="Motivo del warn…"
              className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WARN_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    setReason(p);
                  }}
                  className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-soft hover:bg-line"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setModal(false);
                }}
                className="rounded-full px-4 py-2 text-sm font-bold text-ink-soft hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !reason.trim()}
                className="rounded-full bg-banner px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {done ? "✓ Puesto" : busy ? "Guardando…" : "Poner warn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
