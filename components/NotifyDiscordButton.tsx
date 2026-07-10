"use client";

import { useState } from "react";
import { notifyPendingAttacks, type NotifyResult } from "@/app/war/actions";

// Botón para avisar en Discord de quién falta por atacar (etiquetando a los
// que tienen cuenta vinculada). Solo en la guerra en curso.
export function NotifyDiscordButton() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<NotifyResult | null>(null);

  async function go() {
    setBusy(true);
    setRes(null);
    const r = await notifyPendingAttacks();
    setRes(r);
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <button
        onClick={go}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#5865F2] px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Enviando…" : "🔔 Avisar en Discord"}
      </button>
      {res && (
        <p className={`mt-2 text-center text-xs font-bold ${res.ok ? "text-grass" : "text-banner"}`}>
          {res.ok
            ? `✓ Aviso enviado · ${res.pinged} etiquetado${res.pinged === 1 ? "" : "s"}${
                res.unlinked ? ` · ${res.unlinked} sin Discord` : ""
              }`
            : `✕ ${res.error}`}
        </p>
      )}
    </div>
  );
}
