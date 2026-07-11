"use client";

import { useState } from "react";
import { IdCard } from "lucide-react";
import { publishClanCard } from "@/app/discord/actions";

// Publica o actualiza la tarjeta viva del clan en el canal configurado.
export function PublishClanCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const r = await publishClanCard();
    setBusy(false);
    setMsg(
      r.ok
        ? { ok: true, text: "Tarjeta publicada/actualizada en su canal." }
        : { ok: false, text: r.error ?? "No se pudo." },
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-ink-soft" />
          <div>
            <p className="text-sm font-extrabold text-ink">Tarjeta del clan</p>
            <p className="text-[11px] text-ink-soft">
              Escudo, nivel, liga y puntos. Se refresca sola en cada sincronización.
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="flex-none rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "…" : "Publicar"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs font-semibold ${msg.ok ? "text-grass" : "text-banner"}`}>
          {msg.ok ? "✓ " : "✕ "}
          {msg.text}
        </p>
      )}
    </div>
  );
}
