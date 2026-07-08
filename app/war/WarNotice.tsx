"use client";

import { useState } from "react";

// Bloque con el texto de aviso y un botón para copiarlo al portapapeles.
export function WarNotice({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso de portapapeles: el usuario puede seleccionar y copiar a mano.
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-ink">Aviso para el chat</h2>
        <button
          onClick={copy}
          className="rounded-xl bg-grass px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110"
        >
          {copied ? "¡Copiado! ✓" : "Copiar"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-bg p-3 font-sans text-sm text-ink">
        {text}
      </pre>
    </div>
  );
}
