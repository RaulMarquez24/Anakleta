"use client";

import { useState } from "react";
import { translateLastUpdate } from "@/app/discord/actions";

// Botón para traducir y publicar manualmente el último parte del canal de
// actualizaciones (útil para los que se publicaron antes de activar el bot).
export function TranslateLastUpdate() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; error?: string } | null>(null);

  async function run() {
    setBusy(true);
    setRes(null);
    const r = await translateLastUpdate();
    setBusy(false);
    setRes(r);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-1 text-sm font-extrabold text-ink">Traducir el último parte</p>
      <p className="mb-3 text-xs text-ink-soft">
        Coge el último mensaje del canal de Actualizaciones, lo traduce al español y lo publica debajo.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Traduciendo…" : "🌐 Traducir último"}
      </button>
      {res && (
        <p className={`mt-2 text-sm font-bold ${res.ok ? "text-grass" : "text-banner"}`}>
          {res.ok ? "✓ Traducción publicada." : `✕ ${res.error}`}
        </p>
      )}
    </div>
  );
}
