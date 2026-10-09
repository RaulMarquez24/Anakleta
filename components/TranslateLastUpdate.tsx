"use client";

import { useState } from "react";
import type { DiscordChannel } from "@/lib/discord";
import { translateLastUpdate } from "@/app/discord/actions";

// Traduce y publica manualmente el último parte, usando los canales configurados
// arriba (escucha → publica). Pide confirmación mostrando ambos.
export function TranslateLastUpdate({
  channels,
  originId,
  destId,
}: {
  channels: DiscordChannel[];
  originId: string;
  destId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; error?: string } | null>(null);

  const nameOf = (id: string) => channels.find((c) => c.id === id)?.name ?? "—";
  const dest = destId || originId;

  async function run() {
    setBusy(true);
    setConfirming(false);
    setRes(null);
    const r = await translateLastUpdate(); // usa los canales de la configuración
    setBusy(false);
    setRes(r);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-1 text-sm font-extrabold text-ink">Traducir el último parte</p>
      {originId ? (
        <p className="mb-3 text-xs text-ink-soft">
          Leerá de <strong>{nameOf(originId)}</strong> y publicará la traducción en{" "}
          <strong>{nameOf(dest)}</strong> (configúralo arriba).
        </p>
      ) : (
        <p className="mb-3 text-xs text-banner">
          Configura primero el canal <strong>Actualizaciones · escucha</strong> arriba.
        </p>
      )}

      {confirming ? (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-3">
          <p className="mb-2 text-sm text-ink">
            Leeré el último parte de <strong>{nameOf(originId)}</strong> y publicaré la traducción en{" "}
            <strong>{nameOf(dest)}</strong>. ¿Confirmas?
          </p>
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={busy}
              className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Traduciendo…" : "Sí, traducir y publicar"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-full bg-surface-2 px-4 py-2 text-sm font-extrabold text-ink-soft transition hover:bg-line disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setRes(null);
            setConfirming(true);
          }}
          disabled={busy || !originId}
          className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          🌐 Traducir último
        </button>
      )}

      {res && (
        <p className={`mt-2 text-sm font-bold ${res.ok ? "text-grass" : "text-banner"}`}>
          {res.ok ? "✓ Traducción publicada." : `✕ ${res.error}`}
        </p>
      )}
    </div>
  );
}
