"use client";

import { useState } from "react";

// Muestra el tag del jugador (#ABC123) y lo copia al portapapeles al tocarlo.
// Útil para pegarlo en la búsqueda del juego.
export function CopyTag({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Navegadores sin clipboard API: no hacemos nada (el texto es seleccionable).
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar tag"
      className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-bold text-ink-soft transition hover:bg-line"
    >
      {tag}
      <span aria-hidden>{copied ? "✓" : "📋"}</span>
    </button>
  );
}
