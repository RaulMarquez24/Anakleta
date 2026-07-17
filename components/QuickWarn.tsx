"use client";

import { useState } from "react";
import { addWarn } from "@/app/miembros/actions";
import { WARN_PRESETS } from "@/lib/warn-presets";

// Acción rápida "poner warn" desde un listado. Va dentro de tarjetas que son
// <Link>, así que corta la propagación para no navegar al abrir/usar el modal.
export function QuickWarn({ tag, name }: { tag: string; name: string }) {
  const [open, setOpen] = useState(false);
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
        setOpen(false);
        setDone(false);
      }, 1000);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen(true);
        }}
        title={`Poner warn a ${name}`}
        aria-label={`Poner warn a ${name}`}
        className="flex-none rounded-full border border-line px-2 py-0.5 text-xs font-extrabold text-banner transition hover:bg-banner/10"
      >
        ⚠️
      </button>

      {open && (
        <div
          onClick={(e) => {
            stop(e);
            setOpen(false);
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
                  setOpen(false);
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
    </>
  );
}
