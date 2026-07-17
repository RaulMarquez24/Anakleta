"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Sección plegable: siempre visible el título + un resumen; se despliega para
// interactuar/añadir. Reduce el scroll de la ficha del miembro.
export function Section({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2/40"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</p>
          <div className="truncate text-sm text-ink">{summary}</div>
        </div>
        <ChevronDown
          className={`h-5 w-5 flex-none text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}
