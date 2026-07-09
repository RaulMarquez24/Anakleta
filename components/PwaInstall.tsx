"use client";

import { useEffect, useState } from "react";
import { usePwaInstall } from "@/components/usePwaInstall";

const DISMISS_KEY = "pwa-install-dismissed";

// Banner que sugiere instalar la app. Se puede descartar (y no vuelve a molestar),
// pero el botón fijo de Perfil siempre queda disponible para instalar.
export function PwaInstall({ raised = false }: { raised?: boolean }) {
  const { canInstall, installed, isIos, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const show = !installed && !dismissed && (canInstall || isIos);
  if (!show) return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  }
  async function onInstall() {
    await install();
    dismiss();
  }

  return (
    <div
      className={`fixed inset-x-0 z-30 mx-auto max-w-5xl px-3 ${
        raised ? "bottom-36 sm:bottom-20" : "bottom-16 sm:bottom-3"
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-surface p-3 shadow-xl">
        <span aria-hidden className="text-2xl leading-none">
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-ink">Instala Añakleta</p>
          <p className="text-xs text-ink-soft">
            {isIos && !canInstall
              ? "Toca Compartir → «Añadir a pantalla de inicio»."
              : "Ábrela como app, a pantalla completa y de un toque."}
          </p>
        </div>
        {canInstall && (
          <button
            onClick={onInstall}
            className="flex-none rounded-full bg-gold px-3.5 py-1.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105"
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Ahora no"
          className="flex-none rounded-full p-1.5 text-ink-soft transition hover:bg-surface-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
