"use client";

import { useState } from "react";
import type { DiscordChannel } from "@/lib/discord";
import { setDefaultChannel } from "@/app/discord/actions";

// Elige el canal por defecto donde van los avisos de guerra (botón + cron auto).
export function DefaultChannelSetting({
  channels,
  current,
}: {
  channels: DiscordChannel[];
  current: string | null;
}) {
  const [value, setValue] = useState(current ?? channels[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const r = await setDefaultChannel(value);
    setSaving(false);
    if (r.ok) setSaved(true);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
        Canal de avisos de guerra
      </p>
      <p className="mb-2 text-xs text-ink-soft">
        Dónde publican los recordatorios de guerra (botón manual y automáticos).
      </p>
      {channels.length === 0 ? (
        <p className="text-xs text-banner">No se pudieron cargar los canales (revisa el bot).</p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={save}
            disabled={saving}
            className="flex-none rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
          >
            {saving ? "…" : saved ? "✓" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
