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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-slate-200">Aviso para el chat</h2>
        <button
          onClick={copy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-sm text-slate-300">
        {text}
      </pre>
    </div>
  );
}
