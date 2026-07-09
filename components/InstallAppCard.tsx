"use client";

import { usePwaInstall } from "@/components/usePwaInstall";

// Tarjeta en Perfil para instalar la app como PWA — siempre disponible, no
// depende del banner ni de si se descartó. Cubre Android/escritorio (prompt
// nativo), iOS (instrucciones) y el caso sin evento aún (menú del navegador).
export function InstallAppCard() {
  const { canInstall, installed, isIos, install } = usePwaInstall();

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-extrabold text-ink">📲 Instalar app</h2>

      {installed ? (
        <p className="text-sm font-bold text-grass">✓ Ya está instalada en este dispositivo.</p>
      ) : canInstall ? (
        <>
          <p className="mb-3 text-sm text-ink-soft">Ábrela como app, a pantalla completa y de un toque.</p>
          <button
            onClick={() => install()}
            className="rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105"
          >
            Instalar Añakleta
          </button>
        </>
      ) : isIos ? (
        <p className="text-sm text-ink-soft">
          En iPhone: toca <b>Compartir</b> (el cuadro con la flecha) → <b>«Añadir a pantalla de inicio»</b>.
        </p>
      ) : (
        <p className="text-sm text-ink-soft">
          Si no aparece el botón, ábrela desde el <b>menú del navegador (⋮)</b> →{" "}
          <b>«Instalar app»</b> o <b>«Añadir a pantalla de inicio»</b>.
        </p>
      )}
    </section>
  );
}
