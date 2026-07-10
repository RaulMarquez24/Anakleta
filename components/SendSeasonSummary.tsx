"use client";

import { useState } from "react";
import type { DiscordChannel } from "@/lib/discord";
import { sendSeasonSummary } from "@/app/liga/actions";

// Botón para publicar en Discord el resumen de participación de la temporada.
export function SendSeasonSummary({
  season,
  channels,
  defaultChannelId,
}: {
  season: string;
  channels: DiscordChannel[];
  defaultChannelId: string | null;
}) {
  const [channel, setChannel] = useState(defaultChannelId ?? channels[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; error?: string } | null>(null);

  async function send() {
    setBusy(true);
    setRes(null);
    const r = await sendSeasonSummary(season, channel);
    setBusy(false);
    setRes(r);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 font-extrabold text-ink">Resumen de participación</p>
      <p className="mb-3 text-xs text-ink-soft">
        Publica en Discord el cuadro de estrellas por ronda de toda la temporada.
      </p>
      <div className="flex items-center gap-2">
        {channels.length > 0 && (
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={send}
          disabled={busy}
          className="flex-none rounded-full bg-[#5865F2] px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Enviando…" : "🏆 Enviar a Discord"}
        </button>
      </div>
      {res && (
        <p className={`mt-2 text-sm font-bold ${res.ok ? "text-grass" : "text-banner"}`}>
          {res.ok ? "✓ Resumen publicado." : `✕ ${res.error}`}
        </p>
      )}
    </div>
  );
}
