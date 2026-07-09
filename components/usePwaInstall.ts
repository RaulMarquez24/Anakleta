"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Guardado a nivel de módulo: el evento se dispara una sola vez, así que lo
// compartimos entre todos los que usan el hook (banner + botón de Perfil).
let deferred: BeforeInstallPromptEvent | null = null;

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setInstalled(standalone);

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    setIsIos(ios && safari);

    if (deferred) setCanInstall(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferred = null;
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    setCanInstall(false);
    return choice.outcome === "accepted";
  }

  return { canInstall, installed, isIos, install };
}
