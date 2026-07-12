"use client";

import { useState } from "react";
import { setWarHelpOverride } from "@/app/war/actions";

export interface HelpMember {
  tag: string;
  name: string;
  townHall: number;
  reachableHelp: boolean; // sugerencia automática por TH
}

// Lista del 2º ataque (ayuda) con corrección manual por miembro. El filtro por
// TH acierta casi siempre; con un toque se corrige el caso raro (base denigrante).
export function HelpToggleList({
  warKey,
  members,
  initialOverrides,
}: {
  warKey: string;
  members: HelpMember[];
  initialOverrides: Record<string, boolean>;
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(initialOverrides);
  const [busy, setBusy] = useState<string | null>(null);

  if (members.length === 0) return null;

  const effective = (m: HelpMember) => overrides[m.tag] ?? m.reachableHelp;
  const count = members.filter(effective).length;

  async function toggle(m: HelpMember) {
    if (busy) return;
    const next = !effective(m);
    setBusy(m.tag);
    setOverrides((o) => ({ ...o, [m.tag]: next }));
    const r = await setWarHelpOverride(warKey, m.tag, next);
    if (!r.ok) setOverrides((o) => ({ ...o, [m.tag]: !next })); // revierte si falla
    setBusy(null);
  }

  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/8 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-extrabold text-gold-deep">
          {count}
        </span>
        <h2 className="font-extrabold text-ink">Pueden ayudar con el 2º</h2>
      </div>
      <p className="mb-2.5 text-xs text-ink-soft">
        Opcional, no cuenta como falta. Sugerido por ayuntamiento; toca a cada uno para corregir
        (p. ej. una base denigrante que sí puede reventar).
      </p>
      <ul className="space-y-1.5">
        {members.map((m) => {
          const on = effective(m);
          return (
            <li key={m.tag} className="flex items-center justify-between gap-2">
              <span className={`min-w-0 truncate font-bold ${on ? "text-ink" : "text-ink-soft"}`}>
                {m.name} <span className="text-xs font-semibold text-ink-soft">TH{m.townHall}</span>
              </span>
              <button
                onClick={() => toggle(m)}
                disabled={busy === m.tag}
                className={`flex-none rounded-full px-3 py-1 text-xs font-extrabold transition disabled:opacity-50 ${
                  on
                    ? "bg-gold text-banner-dark hover:brightness-105"
                    : "border border-line bg-surface text-ink-soft hover:bg-surface-2"
                }`}
              >
                {on ? "puede ayudar" : "no hace falta"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
