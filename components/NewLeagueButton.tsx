"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createList, announceOpen } from "@/app/liga/inscripciones/actions";

// Abre la inscripción de una nueva liga (temporada AAAA-MM) y navega a su página.
export function NewLeagueButton({ suggested }: { suggested: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(suggested);
  const [event, setEvent] = useState(false);
  const [notify, setNotify] = useState(true);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function create() {
    const s = month.trim();
    if (!/^\d{4}-\d{2}$/.test(s)) {
      setErr("Elige un mes válido.");
      return;
    }
    setErr(null);
    start(async () => {
      const r = await createList(s, null, null, event);
      if (!r.ok) {
        setErr(r.error ?? "No se pudo crear.");
        return;
      }
      if (notify) await announceOpen(r.season ?? s);
      router.push(`/liga/${encodeURIComponent(r.season ?? s)}`);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gold/40 bg-gold/5 p-3.5 text-left transition hover:bg-gold/10"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gold/20 text-lg">＋</span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-ink">Abrir inscripción de una liga</p>
          <p className="text-xs text-ink-soft">Crea la lista de una temporada para que se apunten</p>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Nueva liga</p>
      {err && <p className="mb-2 rounded-lg bg-banner/10 px-3 py-2 text-sm font-semibold text-banner">{err}</p>}
      <div className="flex gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
        />
        <button
          onClick={create}
          disabled={pending}
          className="flex-none rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {pending ? "…" : "Crear"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={pending}
          className="flex-none rounded-full bg-surface-2 px-3 py-2 text-sm font-extrabold text-ink-soft transition hover:bg-line disabled:opacity-50"
        >
          ✕
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-ink-soft">
        <input type="checkbox" checked={event} onChange={(e) => setEvent(e.target.checked)} />
        Es un evento (liga extra del mismo mes, p. ej. Mundial)
      </label>
      <label className="mt-1 flex items-center gap-2 text-xs font-semibold text-ink-soft">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Avisar al canal general (@Clan) al abrir
      </label>
    </div>
  );
}
