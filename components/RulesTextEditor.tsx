"use client";

import { useState } from "react";
import { saveRulesText, publishRules } from "@/app/normas/actions";

export interface RuleTextView {
  key: string;
  title: string;
  value: string;
}

export function RulesTextEditor({
  blocks,
  discordReady,
}: {
  blocks: RuleTextView[];
  discordReady: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(blocks.map((b) => [b.key, b.value])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveAll() {
    setBusy("save");
    setMsg(null);
    const r = await saveRulesText(values);
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: "Texto guardado." } : { ok: false, text: r.error ?? "Error." });
  }

  async function publish(keys?: string[]) {
    setBusy(keys ? keys[0] : "all");
    setMsg(null);
    // Guarda antes de publicar para que salga lo que se ve.
    await saveRulesText(values);
    const r = await publishRules(keys);
    setBusy(null);
    setMsg(
      r.ok
        ? { ok: true, text: `Publicado en Discord (${r.sent} ${r.sent === 1 ? "bloque" : "bloques"}).` }
        : { ok: false, text: r.error ?? "No se pudo publicar." },
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((b) => (
        <div key={b.key} className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-extrabold text-ink">{b.title}</p>
            <button
              onClick={() => publish([b.key])}
              disabled={!discordReady || busy != null}
              title={discordReady ? "Publicar este bloque en Discord" : "Discord no configurado"}
              className="flex-none rounded-full bg-surface-2 px-3 py-1 text-xs font-extrabold text-ink transition hover:bg-line disabled:opacity-50"
            >
              {busy === b.key ? "Publicando…" : "Publicar"}
            </button>
          </div>
          <textarea
            value={values[b.key]}
            onChange={(e) => setValues((v) => ({ ...v, [b.key]: e.target.value }))}
            rows={10}
            className="w-full resize-y rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink outline-none focus:border-gold"
          />
          <p className="mt-1 text-right text-[11px] font-semibold text-ink-soft">
            {values[b.key]?.length ?? 0} / 1990 caracteres
          </p>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={saveAll}
          disabled={busy != null}
          className="rounded-full border border-line bg-surface px-5 py-2 text-sm font-extrabold text-ink transition hover:bg-surface-2 disabled:opacity-50"
        >
          {busy === "save" ? "Guardando…" : "Guardar texto"}
        </button>
        <button
          onClick={() => publish()}
          disabled={!discordReady || busy != null}
          title={discordReady ? "Publicar todas las normas en Discord" : "Discord no configurado"}
          className="rounded-full bg-gold px-5 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {busy === "all" ? "Publicando…" : "Publicar todo en Discord"}
        </button>
        {msg && (
          <span className={`text-sm font-bold ${msg.ok ? "text-grass" : "text-banner"}`}>
            {msg.text}
          </span>
        )}
      </div>
      {!discordReady && (
        <p className="text-xs text-ink-soft">
          Para publicar, configura el bot y el canal de reglas o de anuncios en el panel de Discord.
        </p>
      )}
    </div>
  );
}
