"use client";

import { useState } from "react";
import type { DiscordChannel } from "@/lib/discord";
import { translateLastUpdate } from "@/app/discord/actions";

// Traduce y publica manualmente el último parte. Elige de qué canal leer
// (origen) y en cuál publicar (destino), con confirmación antes de enviar.
export function TranslateLastUpdate({
  channels,
  defaultChannel,
}: {
  channels: DiscordChannel[];
  defaultChannel: string | null;
}) {
  const fallback = defaultChannel ?? channels[0]?.id ?? "";
  const [origin, setOrigin] = useState(fallback);
  const [destination, setDestination] = useState(fallback);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; error?: string } | null>(null);

  const nameOf = (id: string) => channels.find((c) => c.id === id)?.name ?? "—";

  async function run() {
    setBusy(true);
    setConfirming(false);
    setRes(null);
    const r = await translateLastUpdate(origin, destination);
    setBusy(false);
    setRes(r);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-1 text-sm font-extrabold text-ink">Traducir el último parte</p>
      <p className="mb-3 text-xs text-ink-soft">
        Lee el último mensaje del canal de origen, lo traduce al español y lo publica en el destino.
      </p>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            Origen (de dónde leo)
          </span>
          <select
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setConfirming(false);
              setRes(null);
            }}
            className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            Destino (dónde publico)
          </span>
          <select
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setConfirming(false);
              setRes(null);
            }}
            className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {confirming ? (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-3">
          <p className="mb-2 text-sm text-ink">
            Leeré el último parte de <strong>{nameOf(origin)}</strong> y publicaré la traducción en{" "}
            <strong>{nameOf(destination)}</strong>. ¿Confirmas?
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
          disabled={busy || !origin}
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
