"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Check } from "lucide-react";
import { saveRules } from "@/app/normas/actions";

export interface RuleFieldView {
  key: string;
  group: string;
  token: string;
  affectsApp?: boolean;
  label: string;
  help: string;
  min: number;
  max: number;
  unit: string;
  value: number;
}

function stepFor(max: number): number {
  return max > 2000 ? 100 : 1;
}

export function RulesEditor({ fields }: { fields: RuleFieldView[] }) {
  const [baseline, setBaseline] = useState<Record<string, number>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);

  // Agrupa preservando el orden en que llegan los campos.
  const groups = useMemo(() => {
    const g: { name: string; items: RuleFieldView[] }[] = [];
    for (const f of fields) {
      let grp = g.find((x) => x.name === f.group);
      if (!grp) {
        grp = { name: f.group, items: [] };
        g.push(grp);
      }
      grp.items.push(f);
    }
    return g;
  }, [fields]);

  const dirtyKeys = fields.filter((f) => values[f.key] !== baseline[f.key]).map((f) => f.key);
  const dirty = dirtyKeys.length;

  function setVal(key: string, n: number) {
    const f = byKey.get(key)!;
    const clamped = Math.max(f.min, Math.min(f.max, Math.round(n || 0)));
    setValues((v) => ({ ...v, [key]: clamped }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    const payload = Object.fromEntries(dirtyKeys.map((k) => [k, values[k]]));
    const r = await saveRules(payload);
    setBusy(false);
    if (r.ok) {
      setBaseline({ ...values });
      setSaved(true);
    }
  }

  return (
    <div className="space-y-4 pb-16">
      {groups.map((grp) => (
        <div key={grp.name}>
          <p className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wide text-gold-deep">
            {grp.name}
          </p>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {grp.items.map((f, i) => {
              const step = stepFor(f.max);
              const val = values[f.key];
              const changed = val !== baseline[f.key];
              return (
                <div
                  key={f.key}
                  className={`flex items-center gap-3 p-3.5 ${i > 0 ? "border-t border-line" : ""} ${changed ? "bg-gold/5" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-ink">
                      {f.label}
                      {f.affectsApp && (
                        <span
                          className="rounded bg-sky/15 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-sky"
                          title="Además cambia cómo la app aplica las normas"
                        >
                          app
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">{f.help}</p>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setVal(f.key, val - step)}
                        disabled={val <= f.min}
                        aria-label="Menos"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink transition hover:bg-line disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={val}
                        min={f.min}
                        max={f.max}
                        onChange={(e) => setVal(f.key, Number(e.target.value))}
                        className="w-16 rounded-lg border border-line bg-surface px-1 py-1.5 text-center text-sm font-extrabold text-ink outline-none focus:border-gold"
                      />
                      <button
                        type="button"
                        onClick={() => setVal(f.key, val + step)}
                        disabled={val >= f.max}
                        aria-label="Más"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink transition hover:bg-line disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-[10px] font-semibold text-ink-soft">{f.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Barra de guardado pegajosa: aparece cuando hay cambios */}
      {(dirty > 0 || saved) && (
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
          <span className="text-sm font-bold text-ink">
            {dirty > 0 ? (
              <>
                {dirty} {dirty === 1 ? "cambio sin guardar" : "cambios sin guardar"}
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-grass">
                <Check className="h-4 w-4" /> Guardado
              </span>
            )}
          </span>
          {dirty > 0 && (
            <button
              onClick={save}
              disabled={busy}
              className="rounded-full bg-gold px-5 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
