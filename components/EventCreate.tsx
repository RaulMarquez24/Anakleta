"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createEvent } from "@/app/eventos/actions";

// Crear evento. Plegado por defecto: la lista es para mirar, no para toquetear.
export function EventCreate() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [cards, setCards] = useState(false);

  async function crear() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await createEvent({
      name,
      startsAt: starts || null,
      endsAt: ends || null,
      autoSource: cards ? "cards" : null,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Error");
      return;
    }
    setName("");
    setStarts("");
    setEnds("");
    setCards(false);
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-sm font-extrabold text-ink-soft transition hover:border-gold hover:text-gold"
      >
        <Plus className="h-4 w-4" />
        Nuevo evento
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-1 text-sm font-extrabold text-ink">Nuevo evento</p>
      <p className="mb-3 text-[11px] text-ink-soft">
        Al crearlo pasa a ser el del momento (solo hay uno a la vez); el anterior se cierra y
        conserva su historial.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre (p. ej. Cartas del Clashiversario)"
        maxLength={120}
        className="mb-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
      />
      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold text-ink-soft">
          Empieza
          <input
            type="date"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
        <label className="text-[11px] font-bold text-ink-soft">
          Acaba
          <input
            type="date"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
      </div>
      <label className="mb-3 flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
        <input
          type="checkbox"
          checked={cards}
          onChange={(e) => setCards(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none accent-gold"
        />
        <span className="text-[11px] text-ink-soft">
          <strong className="text-ink">Se marca solo con las cartas de Discord.</strong> Quien
          publique repetidas o cierre un cambio queda como participante sin tocar nada.
        </span>
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={crear}
          disabled={busy || !name.trim()}
          className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "…" : "Crear y activar"}
        </button>
        <button
          onClick={() => setAbierto(false)}
          className="rounded-full border border-line px-3 py-2 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-bold text-banner">{error}</p>}
    </div>
  );
}
