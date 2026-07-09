"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

// Sugerencia de instalar la app como PWA. No aparece si ya está instalada
// (display-mode standalone) ni si el usuario la descartó. En iOS/Safari (que no
// soporta el prompt nativo) muestra las instrucciones manuales.
export function PwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari no dispara beforeinstallprompt: instrucciones manuales.
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-5xl px-3 sm:bottom-3">
      <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-surface p-3 shadow-xl">
        <span aria-hidden className="text-2xl leading-none">
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-ink">Instala Añakleta</p>
          <p className="text-xs text-ink-soft">
            {iosHint
              ? "Toca Compartir → «Añadir a pantalla de inicio»."
              : "Ábrela como app, a pantalla completa y de un toque."}
          </p>
        </div>
        {!iosHint && (
          <button
            onClick={install}
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
