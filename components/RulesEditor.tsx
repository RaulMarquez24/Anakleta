"use client";

import { useState } from "react";
import { saveRules } from "@/app/normas/actions";

export interface RuleFieldView {
  key: string;
  label: string;
  help: string;
  min: number;
  max: number;
  unit: string;
  value: number;
}

export function RulesEditor({ fields }: { fields: RuleFieldView[] }) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = fields.some((f) => values[f.key] !== f.value);

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await saveRules(values);
    setBusy(false);
    setMsg(
      r.ok
        ? { ok: true, text: "Guardado. Se aplica en las próximas lecturas." }
        : { ok: false, text: r.error ?? "No se pudo guardar." },
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-ink">{f.label}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{f.help}</p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={f.min}
                max={f.max}
                value={values[f.key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))
                }
                className="w-20 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-right text-sm font-extrabold text-ink outline-none focus:border-gold"
              />
            </div>
          </div>
          <p className="mt-1 text-right text-[11px] font-semibold text-ink-soft">
            {f.unit} · {f.min}–{f.max}
          </p>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="rounded-full bg-gold px-5 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        {msg && (
          <span className={`text-sm font-bold ${msg.ok ? "text-grass" : "text-banner"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
